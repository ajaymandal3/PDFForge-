#include "pdf_xref_parser.h"

#include <ctype.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void set_error(char *error, size_t error_size, const char *message)
{
    if (!error || error_size == 0)
    {
        return;
    }

    snprintf(error, error_size, "%s", message);
    error[error_size - 1] = '\0';
}

static int is_pdf_whitespace(unsigned char byte)
{
    return byte == '\0' || byte == '\t' || byte == '\n' || byte == '\f' || byte == '\r' || byte == ' ';
}

static void skip_whitespace_and_comments(const unsigned char *bytes, size_t size, size_t *offset)
{
    while (*offset < size)
    {
        unsigned char byte = bytes[*offset];
        if (is_pdf_whitespace(byte))
        {
            ++(*offset);
            continue;
        }

        if (byte == '%')
        {
            while (*offset < size && bytes[*offset] != '\n' && bytes[*offset] != '\r')
            {
                ++(*offset);
            }
            continue;
        }

        break;
    }
}

static int match_keyword(const unsigned char *bytes, size_t size, size_t offset, const char *keyword)
{
    size_t keyword_length = strlen(keyword);
    if (offset + keyword_length > size)
    {
        return 0;
    }

    return memcmp(bytes + offset, keyword, keyword_length) == 0;
}

static const unsigned char *find_last_keyword(const unsigned char *bytes, size_t size, const char *keyword)
{
    size_t keyword_length = strlen(keyword);
    if (keyword_length == 0 || size < keyword_length)
    {
        return NULL;
    }

    for (size_t index = size - keyword_length + 1; index > 0; --index)
    {
        size_t position = index - 1;
        if (memcmp(bytes + position, keyword, keyword_length) == 0)
        {
            return bytes + position;
        }
    }

    return NULL;
}

static int parse_unsigned_token(const unsigned char *bytes, size_t size, size_t *offset, size_t *value)
{
    skip_whitespace_and_comments(bytes, size, offset);
    if (*offset >= size || !isdigit(bytes[*offset]))
    {
        return 0;
    }

    size_t parsed = 0;
    while (*offset < size && isdigit(bytes[*offset]))
    {
        size_t digit = (size_t)(bytes[*offset] - '0');
        if (parsed > (SIZE_MAX - digit) / 10)
        {
            return -1;
        }
        parsed = parsed * 10 + digit;
        ++(*offset);
    }

    *value = parsed;
    return 1;
}

static size_t next_power_of_two(size_t value)
{
    size_t power = 1;
    while (power < value)
    {
        power <<= 1;
    }
    return power;
}

static unsigned int hash_object_id(int object_id)
{
    return (unsigned int)object_id * 2654435761u;
}

static void pdf_xref_map_init_internal(PdfXrefMap *map)
{
    memset(map, 0, sizeof(*map));
}

static int pdf_xref_map_resize(PdfXrefMap *map, size_t new_bucket_count)
{
    PdfXrefEntry *old_entries = map->entries;
    size_t old_count = map->count;
    int *old_keys = map->keys;
    size_t *old_indexes = map->indexes;
    unsigned char *old_states = map->states;

    int *keys = (int *)calloc(new_bucket_count, sizeof(int));
    size_t *indexes = (size_t *)calloc(new_bucket_count, sizeof(size_t));
    unsigned char *states = (unsigned char *)calloc(new_bucket_count, sizeof(unsigned char));
    if (!keys || !indexes || !states)
    {
        free(keys);
        free(indexes);
        free(states);
        return 0;
    }

    map->keys = keys;
    map->indexes = indexes;
    map->states = states;
    map->bucket_count = new_bucket_count;

    if (old_entries && old_count > 0)
    {
        for (size_t index = 0; index < old_count; ++index)
        {
            int object_id = old_entries[index].object_id;
            unsigned int hash = hash_object_id(object_id);
            size_t slot = (size_t)(hash & (new_bucket_count - 1));
            while (map->states[slot] == 1)
            {
                slot = (slot + 1) & (new_bucket_count - 1);
            }
            map->states[slot] = 1;
            map->keys[slot] = object_id;
            map->indexes[slot] = index;
        }
    }

    free(old_keys);
    free(old_indexes);
    free(old_states);
    return 1;
}

static int pdf_xref_map_ensure_entries(PdfXrefMap *map, size_t required_count)
{
    if (required_count <= map->capacity)
    {
        return 1;
    }

    size_t new_capacity = map->capacity == 0 ? 32 : map->capacity;
    while (new_capacity < required_count)
    {
        new_capacity <<= 1;
    }

    PdfXrefEntry *entries = (PdfXrefEntry *)realloc(map->entries, new_capacity * sizeof(PdfXrefEntry));
    if (!entries)
    {
        return 0;
    }

    map->entries = entries;
    map->capacity = new_capacity;
    return 1;
}

static size_t pdf_xref_map_probe(const PdfXrefMap *map, int object_id, int *found)
{
    size_t mask = map->bucket_count - 1;
    size_t slot = (size_t)(hash_object_id(object_id) & mask);
    size_t start = slot;

    while (map->states[slot] != 0)
    {
        if (map->states[slot] == 1 && map->keys[slot] == object_id)
        {
            *found = 1;
            return slot;
        }
        slot = (slot + 1) & mask;
        if (slot == start)
        {
            break;
        }
    }

    *found = 0;
    return slot;
}

static int pdf_xref_map_put(PdfXrefMap *map, int object_id, int generation, size_t byte_offset, int in_use, char *error, size_t error_size)
{
    if (map->bucket_count == 0 || (map->count + 1) * 10 >= map->bucket_count * 7)
    {
        size_t next_bucket_count = map->bucket_count == 0 ? 32 : map->bucket_count * 2;
        if (!pdf_xref_map_resize(map, next_bucket_count))
        {
            set_error(error, error_size, "Unable to allocate xref hash map");
            return 0;
        }
    }

    int found = 0;
    size_t slot = pdf_xref_map_probe(map, object_id, &found);
    if (found)
    {
        size_t index = map->indexes[slot];
        map->entries[index].generation = generation;
        map->entries[index].byte_offset = byte_offset;
        map->entries[index].in_use = in_use;
        return 1;
    }

    if (!pdf_xref_map_ensure_entries(map, map->count + 1))
    {
        set_error(error, error_size, "Unable to allocate xref entry list");
        return 0;
    }

    size_t index = map->count;
    map->entries[index].object_id = object_id;
    map->entries[index].generation = generation;
    map->entries[index].byte_offset = byte_offset;
    map->entries[index].in_use = in_use;
    map->keys[slot] = object_id;
    map->indexes[slot] = index;
    map->states[slot] = 1;
    map->count += 1;
    return 1;
}

void pdf_xref_table_init(PdfXrefTable *table)
{
    if (!table)
    {
        return;
    }

    pdf_xref_map_init_internal(&table->map);
    table->xref_offset = 0;
    table->startxref_offset = 0;
    table->trailer_offset = 0;
    table->subsection_count = 0;
}

void pdf_xref_table_free(PdfXrefTable *table)
{
    if (!table)
    {
        return;
    }

    free(table->map.entries);
    free(table->map.keys);
    free(table->map.indexes);
    free(table->map.states);
    pdf_xref_table_init(table);
}

int pdf_xref_parse(const unsigned char *bytes, size_t size, PdfXrefTable *table, char *error, size_t error_size)
{
    if (!bytes || !table)
    {
        set_error(error, error_size, "Invalid xref parse arguments");
        return 0;
    }

    pdf_xref_table_init(table);

    const unsigned char *startxref_keyword = find_last_keyword(bytes, size, "startxref");
    if (!startxref_keyword)
    {
        set_error(error, error_size, "startxref keyword not found");
        return 0;
    }

    size_t offset = (size_t)(startxref_keyword - bytes) + strlen("startxref");
    size_t startxref_value = 0;
    int parsed_startxref = parse_unsigned_token(bytes, size, &offset, &startxref_value);
    if (parsed_startxref <= 0)
    {
        set_error(error, error_size, parsed_startxref == 0 ? "Unable to parse startxref offset" : "startxref offset overflowed");
        return 0;
    }

    if (startxref_value >= size)
    {
        set_error(error, error_size, "startxref points outside the PDF buffer");
        return 0;
    }

    table->startxref_offset = startxref_value;
    table->xref_offset = startxref_value;

    size_t cursor = startxref_value;
    skip_whitespace_and_comments(bytes, size, &cursor);
    if (!match_keyword(bytes, size, cursor, "xref"))
    {
        set_error(error, error_size, "Classic xref table not found at startxref offset");
        return 0;
    }

    cursor += strlen("xref");

    while (cursor < size)
    {
        skip_whitespace_and_comments(bytes, size, &cursor);
        if (cursor >= size)
        {
            break;
        }

        if (match_keyword(bytes, size, cursor, "trailer"))
        {
            table->trailer_offset = cursor;
            break;
        }

        size_t start_object = 0;
        size_t entry_count = 0;
        int parsed_start = parse_unsigned_token(bytes, size, &cursor, &start_object);
        if (parsed_start <= 0)
        {
            set_error(error, error_size, parsed_start == 0 ? "Unable to parse xref subsection start object" : "xref subsection start object overflowed");
            return 0;
        }

        int parsed_count = parse_unsigned_token(bytes, size, &cursor, &entry_count);
        if (parsed_count <= 0)
        {
            set_error(error, error_size, parsed_count == 0 ? "Unable to parse xref subsection count" : "xref subsection count overflowed");
            return 0;
        }

        table->subsection_count += 1;

        for (size_t entry_index = 0; entry_index < entry_count; ++entry_index)
        {
            size_t byte_offset = 0;
            size_t generation_value = 0;
            int parsed_offset = parse_unsigned_token(bytes, size, &cursor, &byte_offset);
            if (parsed_offset <= 0)
            {
                set_error(error, error_size, parsed_offset == 0 ? "Unable to parse xref entry offset" : "xref entry offset overflowed");
                return 0;
            }

            int parsed_generation = parse_unsigned_token(bytes, size, &cursor, &generation_value);
            if (parsed_generation <= 0)
            {
                set_error(error, error_size, parsed_generation == 0 ? "Unable to parse xref entry generation" : "xref entry generation overflowed");
                return 0;
            }

            skip_whitespace_and_comments(bytes, size, &cursor);
            if (cursor >= size)
            {
                set_error(error, error_size, "Unexpected end of PDF while reading xref entry flag");
                return 0;
            }

            unsigned char usage = bytes[cursor++];
            if (usage != 'n' && usage != 'f')
            {
                set_error(error, error_size, "Invalid xref entry flag");
                return 0;
            }

            if (start_object > (size_t)INT_MAX || entry_index > (size_t)INT_MAX || generation_value > (size_t)INT_MAX)
            {
                set_error(error, error_size, "xref object metadata exceeds parser limits");
                return 0;
            }

            if (!pdf_xref_map_put(&table->map, (int)(start_object + entry_index), (int)generation_value, byte_offset, usage == 'n', error, error_size))
            {
                return 0;
            }
        }
    }

    return 1;
}