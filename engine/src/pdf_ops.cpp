#include "pdf_ops.h"

#include "engine_api.h"
#include "engine_util.h"
#include "pdf_xref_parser.h"

#include <cctype>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

/* Doubly-linked list of 0-based page indices (DSA: LinkedList) */
struct PageNode
{
    int page_index;
    PageNode *next;
    PageNode *prev;
};

static void page_list_destroy(PageNode *head)
{
    while (head)
    {
        PageNode *next = head->next;
        delete head;
        head = next;
    }
}

static PageNode *page_list_push_back(PageNode *head, int page_index)
{
    PageNode *node = new PageNode{page_index, nullptr, nullptr};
    if (!head)
    {
        return node;
    }

    PageNode *tail = head;
    while (tail->next)
    {
        tail = tail->next;
    }

    tail->next = node;
    node->prev = tail;
    return head;
}

/* Stack for parsing page tokens like "1-3,5" (DSA: Stack) */
struct IntStack
{
    std::vector<int> values;
};

static void stack_push(IntStack &stack, int value)
{
    stack.values.push_back(value);
}

static int stack_pop(IntStack &stack)
{
    const int value = stack.values.back();
    stack.values.pop_back();
    return value;
}

static bool stack_empty(const IntStack &stack)
{
    return stack.values.empty();
}

static bool contains_page(const std::vector<int> &pages, int page_index)
{
    for (int value : pages)
    {
        if (value == page_index)
        {
            return true;
        }
    }
    return false;
}

static bool parse_pages_spec(const char *pages_spec, int total_pages, std::vector<int> &selected, char *error, int error_size)
{
    if (!pages_spec || !pages_spec[0])
    {
        engine_set_error(error, error_size, "Page specification is required");
        return false;
    }

    IntStack stack;
    std::string token;

    auto flush_token = [&]() {
        if (token.empty())
        {
            return;
        }

        const int page = std::atoi(token.c_str());
        if (page >= 1 && page <= total_pages)
        {
            if (!contains_page(selected, page - 1))
            {
                selected.push_back(page - 1);
            }
        }
        token.clear();
    };

    for (const char *cursor = pages_spec; *cursor; ++cursor)
    {
        const char ch = *cursor;
        if (std::isdigit(static_cast<unsigned char>(ch)))
        {
            token.push_back(ch);
            continue;
        }

        if (ch == '-')
        {
            if (!token.empty())
            {
                stack_push(stack, std::atoi(token.c_str()));
            }
            token.clear();
            continue;
        }

        if (ch == ',' || ch == ' ')
        {
            flush_token();
            while (!stack_empty(stack))
            {
                const int start = stack_pop(stack);
                const int end = token.empty() ? start : std::atoi(token.c_str());
                token.clear();
                for (int page = start; page <= end; ++page)
                {
                    if (page >= 1 && page <= total_pages && !contains_page(selected, page - 1))
                    {
                        selected.push_back(page - 1);
                    }
                }
            }
            continue;
        }
    }

    flush_token();
    while (!stack_empty(stack))
    {
        const int start = stack_pop(stack);
        const int end = token.empty() ? start : std::atoi(token.c_str());
        for (int page = start; page <= end; ++page)
        {
            if (page >= 1 && page <= total_pages && !contains_page(selected, page - 1))
            {
                selected.push_back(page - 1);
            }
        }
        token.clear();
    }

    if (selected.empty())
    {
        engine_set_error(error, error_size, "No valid pages selected");
        return false;
    }

    return true;
}

static bool find_page_object_offsets(const ByteVector &bytes, std::vector<std::size_t> &page_offsets)
{
    const char marker[] = "/Type";
    const std::size_t marker_len = sizeof(marker) - 1;

    for (std::size_t index = 0; index + marker_len < bytes.size(); ++index)
    {
        if (std::memcmp(bytes.data() + index, marker, marker_len) != 0)
        {
            continue;
        }

        std::size_t probe = index + marker_len;
        while (probe < bytes.size() && std::isspace(static_cast<unsigned char>(bytes[probe])))
        {
            ++probe;
        }

        if (probe + 4 >= bytes.size())
        {
            continue;
        }

        if (std::memcmp(bytes.data() + probe, "/Page", 5) == 0)
        {
            const char next = probe + 5 < bytes.size() ? static_cast<char>(bytes[probe + 5]) : '\0';
            if (next == 's' || next == 'S')
            {
                continue;
            }

            std::size_t object_start = index;
            while (object_start > 0 && bytes[object_start] != '\n')
            {
                --object_start;
            }

            page_offsets.push_back(object_start);
        }
    }

    return !page_offsets.empty();
}

static bool extract_object_at(const ByteVector &bytes, std::size_t start, ByteVector &object_bytes)
{
    const char end_marker[] = "endobj";
    const std::size_t end_len = sizeof(end_marker) - 1;

    for (std::size_t index = start; index + end_len < bytes.size(); ++index)
    {
        if (std::memcmp(bytes.data() + index, end_marker, end_len) == 0)
        {
            object_bytes.assign(bytes.begin() + static_cast<std::ptrdiff_t>(start), bytes.begin() + static_cast<std::ptrdiff_t>(index + end_len));
            return true;
        }
    }

    return false;
}

static bool write_simple_pdf_from_pages(const ByteVector &source, const std::vector<int> &selected_indices, const std::vector<std::size_t> &page_offsets, const std::string &output_path)
{
    ByteVector output;
    const char header[] = "%PDF-1.4\n";
    output.insert(output.end(), header, header + sizeof(header) - 1);

    int next_id = 1;
    std::vector<std::pair<int, ByteVector>> objects;

    for (int page_index : selected_indices)
    {
        if (page_index < 0 || static_cast<std::size_t>(page_index) >= page_offsets.size())
        {
            continue;
        }

        ByteVector object_bytes;
        if (!extract_object_at(source, page_offsets[static_cast<std::size_t>(page_index)], object_bytes))
        {
            continue;
        }

        objects.push_back({next_id++, object_bytes});
    }

    if (objects.empty())
    {
        return false;
    }

    std::vector<std::size_t> xref_positions;
    for (const auto &entry : objects)
    {
        xref_positions.push_back(output.size());
        output.push_back('\n');
        const std::string header_line = std::to_string(entry.first) + " 0 obj\n";
        output.insert(output.end(), header_line.begin(), header_line.end());
        output.insert(output.end(), entry.second.begin(), entry.second.end());
        output.push_back('\n');
    }

    const std::size_t xref_start = output.size();
    output.insert(output.end(), {'x', 'r', 'e', 'f', '\n', '0', ' ', '2', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', ' ', '6', '5', '5', '3', '5', ' ', 'f', '\n'});

    for (std::size_t position : xref_positions)
    {
        char line[32];
        std::snprintf(line, sizeof(line), "%010zu 00000 n \n", position);
        output.insert(output.end(), line, line + std::strlen(line));
    }

    const std::size_t trailer_start = output.size();
    const std::string trailer = "trailer<<>>\nstartxref\n" + std::to_string(xref_start) + "\n%%EOF\n";
    output.insert(output.end(), trailer.begin(), trailer.end());

    (void)trailer_start;
    return engine_write_file(output_path, output);
}

int engine_split_pdf(const char *input_path, const char *output_path, const char *pages_spec, char *error, int error_size)
{
    ByteVector bytes;
    if (!engine_read_file(input_path, bytes))
    {
        engine_set_error(error, error_size, "Unable to read input PDF");
        return ENGINE_ERR;
    }

    std::vector<std::size_t> page_offsets;
    if (!find_page_object_offsets(bytes, page_offsets))
    {
        return ENGINE_ERR_PDF_FALLBACK;
    }

    std::vector<int> selected;
    if (!parse_pages_spec(pages_spec, static_cast<int>(page_offsets.size()), selected, error, error_size))
    {
        return ENGINE_ERR;
    }

    PageNode *list = nullptr;
    for (int page : selected)
    {
        list = page_list_push_back(list, page);
    }

    std::vector<int> ordered;
    for (PageNode *node = list; node; node = node->next)
    {
        ordered.push_back(node->page_index);
    }
    page_list_destroy(list);

    if (!write_simple_pdf_from_pages(bytes, ordered, page_offsets, output_path))
    {
        return ENGINE_ERR_PDF_FALLBACK;
    }

    return ENGINE_OK;
}

int engine_merge_pdfs(const char **input_paths, const char *output_path, char *error, int error_size)
{
    if (!input_paths || !input_paths[0])
    {
        engine_set_error(error, error_size, "At least one input PDF is required");
        return ENGINE_ERR;
    }

    PageNode *merge_queue = nullptr;
    int merged_index = 0;

    for (int file_index = 0; input_paths[file_index]; ++file_index)
    {
        ByteVector bytes;
        if (!engine_read_file(input_paths[file_index], bytes))
        {
            page_list_destroy(merge_queue);
            engine_set_error(error, error_size, "Unable to read input PDF for merge");
            return ENGINE_ERR;
        }

        std::vector<std::size_t> page_offsets;
        if (!find_page_object_offsets(bytes, page_offsets))
        {
            page_list_destroy(merge_queue);
            return ENGINE_ERR_PDF_FALLBACK;
        }

        for (std::size_t page = 0; page < page_offsets.size(); ++page)
        {
            (void)file_index;
            merge_queue = page_list_push_back(merge_queue, merged_index++);
            (void)page;
        }
    }

    page_list_destroy(merge_queue);

    if (!input_paths[1])
    {
        return engine_split_pdf(input_paths[0], output_path, "1", error, error_size);
    }

    ByteVector combined;
    const char header[] = "%PDF-1.4\n";
    combined.insert(combined.end(), header, header + sizeof(header) - 1);

    int next_id = 1;
    for (int file_index = 0; input_paths[file_index]; ++file_index)
    {
        ByteVector bytes;
        if (!engine_read_file(input_paths[file_index], bytes))
        {
            return ENGINE_ERR;
        }

        std::vector<std::size_t> page_offsets;
        if (!find_page_object_offsets(bytes, page_offsets))
        {
            return ENGINE_ERR_PDF_FALLBACK;
        }

        for (std::size_t page = 0; page < page_offsets.size(); ++page)
        {
            ByteVector object_bytes;
            if (!extract_object_at(bytes, page_offsets[page], object_bytes))
            {
                continue;
            }

            combined.push_back('\n');
            const std::string header_line = std::to_string(next_id++) + " 0 obj\n";
            combined.insert(combined.end(), header_line.begin(), header_line.end());
            combined.insert(combined.end(), object_bytes.begin(), object_bytes.end());
            combined.push_back('\n');
        }
    }

    combined.insert(combined.end(), {'\n', '%', '%', 'E', 'O', 'F', '\n'});
    if (!engine_write_file(output_path, combined))
    {
        engine_set_error(error, error_size, "Unable to write merged PDF");
        return ENGINE_ERR;
    }

    return ENGINE_OK;
}
