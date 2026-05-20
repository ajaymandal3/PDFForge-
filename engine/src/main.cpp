#include <algorithm>
#include <cmath>
#include <chrono>
#include <cstddef>
#include <cstdint>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

#include "pdf_xref_parser.h"

using Byte = unsigned char;

struct Node
{
    std::size_t frequency;
    int symbol;
    Node *left;
    Node *right;

    Node(std::size_t freq, int sym, Node *l = nullptr, Node *r = nullptr)
        : frequency(freq), symbol(sym), left(l), right(r) {}

    bool isLeaf() const
    {
        return left == nullptr && right == nullptr;
    }
};

class MinHeap
{
public:
    void push(Node *node)
    {
        heap.push_back(node);
        siftUp(heap.size() - 1);
    }

    Node *pop()
    {
        if (heap.empty())
        {
            return nullptr;
        }
        Node *root = heap.front();
        heap.front() = heap.back();
        heap.pop_back();
        if (!heap.empty())
        {
            siftDown(0);
        }
        return root;
    }

    std::size_t size() const
    {
        return heap.size();
    }

private:
    std::vector<Node *> heap;

    void siftUp(std::size_t index)
    {
        while (index > 0)
        {
            std::size_t parent = (index - 1) / 2;
            if (heap[parent]->frequency <= heap[index]->frequency)
            {
                break;
            }
            std::swap(heap[parent], heap[index]);
            index = parent;
        }
    }

    void siftDown(std::size_t index)
    {
        while (true)
        {
            std::size_t left = index * 2 + 1;
            std::size_t right = index * 2 + 2;
            std::size_t smallest = index;

            if (left < heap.size() && heap[left]->frequency < heap[smallest]->frequency)
            {
                smallest = left;
            }
            if (right < heap.size() && heap[right]->frequency < heap[smallest]->frequency)
            {
                smallest = right;
            }
            if (smallest == index)
            {
                break;
            }
            std::swap(heap[index], heap[smallest]);
            index = smallest;
        }
    }
};

struct BitWriter
{
    std::vector<Byte> data;
    Byte current = 0;
    int bitCount = 0;
    std::uint64_t totalBits = 0;

    void writeBit(int bit)
    {
        current <<= 1;
        current |= static_cast<Byte>(bit & 1);
        ++bitCount;
        ++totalBits;
        if (bitCount == 8)
        {
            data.push_back(current);
            current = 0;
            bitCount = 0;
        }
    }

    void writeCode(const std::string &code)
    {
        for (char bit : code)
        {
            writeBit(bit == '1' ? 1 : 0);
        }
    }

    void flush()
    {
        if (bitCount == 0)
        {
            return;
        }
        current <<= static_cast<Byte>(8 - bitCount);
        data.push_back(current);
        current = 0;
        bitCount = 0;
    }
};

struct BitReader
{
    const std::vector<Byte> &data;
    std::size_t index = 0;
    int bitIndex = 0;

    explicit BitReader(const std::vector<Byte> &bytes) : data(bytes) {}

    int readBit()
    {
        if (index >= data.size())
        {
            return -1;
        }
        int bit = (data[index] >> (7 - bitIndex)) & 1;
        ++bitIndex;
        if (bitIndex == 8)
        {
            bitIndex = 0;
            ++index;
        }
        return bit;
    }
};

static std::uint64_t nowMs()
{
    using namespace std::chrono;
    return duration_cast<milliseconds>(steady_clock::now().time_since_epoch()).count();
}

static std::vector<Byte> readFile(const std::string &path)
{
    std::ifstream file(path, std::ios::binary);
    return std::vector<Byte>((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
}

static bool writeFile(const std::string &path, const std::vector<Byte> &bytes)
{
    std::ofstream file(path, std::ios::binary);
    if (!file)
    {
        return false;
    }
    file.write(reinterpret_cast<const char *>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
    return true;
}

static void writeUint16(std::vector<Byte> &output, std::uint16_t value)
{
    output.push_back(static_cast<Byte>(value & 0xFF));
    output.push_back(static_cast<Byte>((value >> 8) & 0xFF));
}

static void writeUint32(std::vector<Byte> &output, std::uint32_t value)
{
    for (int i = 0; i < 4; ++i)
    {
        output.push_back(static_cast<Byte>((value >> (8 * i)) & 0xFF));
    }
}

static void writeUint64(std::vector<Byte> &output, std::uint64_t value)
{
    for (int i = 0; i < 8; ++i)
    {
        output.push_back(static_cast<Byte>((value >> (8 * i)) & 0xFF));
    }
}

static std::uint16_t readUint16(const std::vector<Byte> &input, std::size_t &offset)
{
    std::uint16_t value = 0;
    for (int i = 0; i < 2; ++i)
    {
        value |= static_cast<std::uint16_t>(input[offset++]) << (8 * i);
    }
    return value;
}

static std::uint32_t readUint32(const std::vector<Byte> &input, std::size_t &offset)
{
    std::uint32_t value = 0;
    for (int i = 0; i < 4; ++i)
    {
        value |= static_cast<std::uint32_t>(input[offset++]) << (8 * i);
    }
    return value;
}

static std::uint64_t readUint64(const std::vector<Byte> &input, std::size_t &offset)
{
    std::uint64_t value = 0;
    for (int i = 0; i < 8; ++i)
    {
        value |= static_cast<std::uint64_t>(input[offset++]) << (8 * i);
    }
    return value;
}

static Node *buildTree(const std::vector<std::uint32_t> &frequency)
{
    MinHeap heap;
    for (int symbol = 0; symbol < 256; ++symbol)
    {
        if (frequency[symbol] > 0)
        {
            heap.push(new Node(frequency[symbol], symbol));
        }
    }

    if (heap.size() == 0)
    {
        return nullptr;
    }

    if (heap.size() == 1)
    {
        Node *only = heap.pop();
        return new Node(only->frequency, -1, only, nullptr);
    }

    while (heap.size() > 1)
    {
        Node *first = heap.pop();
        Node *second = heap.pop();
        heap.push(new Node(first->frequency + second->frequency, -1, first, second));
    }

    return heap.pop();
}

static void buildCodes(Node *node, const std::string &prefix, std::vector<std::string> &codes)
{
    if (!node)
    {
        return;
    }

    if (node->isLeaf())
    {
        codes[node->symbol] = prefix.empty() ? "0" : prefix;
        return;
    }

    buildCodes(node->left, prefix + "0", codes);
    buildCodes(node->right, prefix + "1", codes);
}

static void destroyTree(Node *node)
{
    if (!node)
    {
        return;
    }
    destroyTree(node->left);
    destroyTree(node->right);
    delete node;
}

static std::string jsonEscape(const std::string &value)
{
    std::ostringstream out;
    for (char ch : value)
    {
        switch (ch)
        {
        case '\\':
            out << "\\\\";
            break;
        case '"':
            out << "\\\"";
            break;
        case '\n':
            out << "\\n";
            break;
        case '\r':
            out << "\\r";
            break;
        case '\t':
            out << "\\t";
            break;
        default:
            out << ch;
            break;
        }
    }
    return out.str();
}

static void printJson(bool ok, const std::string &mode, const std::string &input, const std::string &output, std::uint64_t originalSize, std::uint64_t outputSize, std::uint64_t elapsedMs, const std::string &message = "", const std::string &fileName = "")
{
    std::ostringstream json;
    double ratio = originalSize == 0 ? 0.0 : static_cast<double>(outputSize) / static_cast<double>(originalSize);
    json << "{";
    json << "\"ok\":" << (ok ? "true" : "false") << ",";
    json << "\"mode\":\"" << mode << "\",";
    json << "\"input\":\"" << jsonEscape(input) << "\",";
    json << "\"output\":\"" << jsonEscape(output) << "\",";
    json << "\"originalSize\":" << originalSize << ",";
    json << "\"outputSize\":" << outputSize << ",";
    json << "\"compressionRatio\":" << std::fixed << std::setprecision(4) << ratio << ",";
    json << "\"timeMs\":" << elapsedMs;
    if (!fileName.empty())
    {
        json << ",\"fileName\":\"" << jsonEscape(fileName) << "\"";
    }
    if (!message.empty())
    {
        json << ",\"message\":\"" << jsonEscape(message) << "\"";
    }
    json << "}";
    std::cout << json.str();
}

static bool readFileStrict(const std::string &path, std::vector<Byte> &bytes)
{
    std::ifstream file(path, std::ios::binary);
    if (!file)
    {
        return false;
    }

    bytes = std::vector<Byte>((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    return true;
}

static bool writeTextFile(const std::string &path, const std::string &content)
{
    std::ofstream file(path, std::ios::binary);
    if (!file)
    {
        return false;
    }

    file << content;
    return static_cast<bool>(file);
}

static std::string renderXrefJson(const std::string &inputPath, const std::string &outputPath, const PdfXrefTable &table)
{
    std::ostringstream json;
    json << "{";
    json << "\"ok\":true,";
    json << "\"mode\":\"xref-parse\",";
    json << "\"input\":\"" << jsonEscape(inputPath) << "\",";
    json << "\"output\":\"" << jsonEscape(outputPath) << "\",";
    json << "\"xrefOffset\":" << table.xref_offset << ",";
    json << "\"startxrefOffset\":" << table.startxref_offset << ",";
    json << "\"trailerOffset\":" << table.trailer_offset << ",";
    json << "\"subsectionCount\":" << table.subsection_count << ",";
    json << "\"entryCount\":" << table.map.count << ",";
    json << "\"entries\":[";

    for (std::size_t index = 0; index < table.map.count; ++index)
    {
        const PdfXrefEntry &entry = table.map.entries[index];
        if (index > 0)
        {
            json << ",";
        }
        json << "{";
        json << "\"objectId\":" << entry.object_id << ",";
        json << "\"generation\":" << entry.generation << ",";
        json << "\"byteOffset\":" << entry.byte_offset << ",";
        json << "\"inUse\":" << (entry.in_use ? "true" : "false");
        json << "}";
    }

    json << "]";
    json << "}";
    return json.str();
}

static int parseXrefFile(const std::string &inputPath, const std::string &outputPath)
{
    std::vector<Byte> bytes;
    if (!readFileStrict(inputPath, bytes))
    {
        std::cerr << "Failed to read input PDF" << std::endl;
        return 1;
    }

    PdfXrefTable table;
    char error[256] = {0};
    if (!pdf_xref_parse(bytes.data(), bytes.size(), &table, error, sizeof(error)))
    {
        std::cerr << error << std::endl;
        pdf_xref_table_free(&table);
        return 1;
    }

    std::string json = renderXrefJson(inputPath, outputPath, table);
    if (!outputPath.empty() && !writeTextFile(outputPath, json))
    {
        std::cerr << "Unable to write xref report" << std::endl;
        pdf_xref_table_free(&table);
        return 1;
    }

    std::cout << json;
    pdf_xref_table_free(&table);
    return 0;
}

static int compressFile(const std::string &inputPath, const std::string &outputPath)
{
    auto started = nowMs();
    std::vector<Byte> input = readFile(inputPath);
    std::vector<std::uint32_t> frequency(256, 0);
    for (Byte byte : input)
    {
        ++frequency[byte];
    }

    Node *root = buildTree(frequency);
    std::vector<std::string> codes(256);
    buildCodes(root, "", codes);

    BitWriter writer;
    for (Byte byte : input)
    {
        writer.writeCode(codes[byte]);
    }
    writer.flush();

    std::vector<Byte> output;
    output.insert(output.end(), {'H', 'U', 'F', 'Z'});
    output.push_back(1);

    std::string fileName = inputPath;
    std::size_t slash = fileName.find_last_of("/\\");
    if (slash != std::string::npos)
    {
        fileName = fileName.substr(slash + 1);
    }
    writeUint16(output, static_cast<std::uint16_t>(fileName.size()));
    output.insert(output.end(), fileName.begin(), fileName.end());
    writeUint64(output, static_cast<std::uint64_t>(input.size()));
    writeUint64(output, writer.totalBits);
    for (std::uint32_t value : frequency)
    {
        writeUint32(output, value);
    }
    output.insert(output.end(), writer.data.begin(), writer.data.end());

    bool written = writeFile(outputPath, output);
    std::uint64_t elapsed = nowMs() - started;
    destroyTree(root);

    if (!written)
    {
        printJson(false, "compress", inputPath, outputPath, input.size(), 0, elapsed, "Unable to write compressed file");
        return 1;
    }

    printJson(true, "compress", inputPath, outputPath, input.size(), output.size(), elapsed);
    return 0;
}

static int decompressFile(const std::string &inputPath, const std::string &outputPath)
{
    auto started = nowMs();
    std::vector<Byte> input = readFile(inputPath);
    if (input.size() < 4 || input[0] != 'H' || input[1] != 'U' || input[2] != 'F' || input[3] != 'Z')
    {
        printJson(false, "decompress", inputPath, outputPath, 0, 0, 0, "Invalid HuffZip archive");
        return 1;
    }

    std::size_t offset = 4;
    ++offset;
    std::uint16_t fileNameLength = readUint16(input, offset);
    std::string fileName;
    for (std::uint16_t index = 0; index < fileNameLength; ++index)
    {
        fileName.push_back(static_cast<char>(input[offset++]));
    }
    std::uint64_t originalSize = readUint64(input, offset);
    std::uint64_t bitCount = readUint64(input, offset);

    std::vector<std::uint32_t> frequency(256, 0);
    for (int index = 0; index < 256; ++index)
    {
        frequency[index] = readUint32(input, offset);
    }

    std::vector<Byte> payload(input.begin() + static_cast<std::ptrdiff_t>(offset), input.end());
    Node *root = buildTree(frequency);
    std::vector<Byte> output;
    output.reserve(static_cast<std::size_t>(originalSize));

    if (!root)
    {
        destroyTree(root);
        bool written = writeFile(outputPath, output);
        std::uint64_t elapsed = nowMs() - started;
        if (!written)
        {
            printJson(false, "decompress", inputPath, outputPath, originalSize, 0, elapsed, "Unable to write output file");
            return 1;
        }
        printJson(true, "decompress", inputPath, outputPath, originalSize, output.size(), elapsed, "", fileName);
        return 0;
    }

    if (root->isLeaf())
    {
        output.assign(static_cast<std::size_t>(originalSize), static_cast<Byte>(root->symbol));
    }
    else
    {
        BitReader reader(payload);
        Node *current = root;
        for (std::uint64_t processed = 0; processed < bitCount; ++processed)
        {
            int bit = reader.readBit();
            if (bit < 0)
            {
                break;
            }
            current = bit == 0 ? current->left : current->right;
            if (current->isLeaf())
            {
                output.push_back(static_cast<Byte>(current->symbol));
                current = root;
                if (output.size() >= originalSize)
                {
                    break;
                }
            }
        }
    }

    bool written = writeFile(outputPath, output);
    std::uint64_t elapsed = nowMs() - started;
    destroyTree(root);

    if (!written)
    {
        printJson(false, "decompress", inputPath, outputPath, originalSize, 0, elapsed, "Unable to write output file");
        return 1;
    }

    printJson(true, "decompress", inputPath, outputPath, originalSize, output.size(), elapsed, "", fileName);
    return 0;
}

static int analyzeFile(const std::string &inputPath)
{
    auto started = nowMs();
    std::vector<Byte> input = readFile(inputPath);
    std::vector<std::uint32_t> frequency(256, 0);
    for (Byte byte : input)
    {
        ++frequency[byte];
    }

    double entropy = 0.0;
    for (std::uint32_t value : frequency)
    {
        if (value == 0 || input.empty())
        {
            continue;
        }
        double probability = static_cast<double>(value) / static_cast<double>(input.size());
        entropy -= probability * std::log2(probability);
    }

    std::size_t repeated = 0;
    for (std::size_t index = 1; index < input.size(); ++index)
    {
        if (input[index] == input[index - 1])
        {
            ++repeated;
        }
    }

    std::string recommendation = (entropy < 4.5 || (input.size() > 0 && repeated > input.size() / 4)) ? "RLE" : "Huffman";
    std::uint64_t elapsed = nowMs() - started;

    std::ostringstream json;
    json << "{";
    json << "\"ok\":true,";
    json << "\"mode\":\"analyze\",";
    json << "\"input\":\"" << jsonEscape(inputPath) << "\",";
    json << "\"entropy\":" << std::fixed << std::setprecision(4) << entropy << ",";
    json << "\"repetitionIndex\":" << std::fixed << std::setprecision(4)
         << (input.empty() ? 0.0 : static_cast<double>(repeated) / static_cast<double>(input.size())) << ",";
    json << "\"recommendation\":\"" << recommendation << "\",";
    json << "\"timeMs\":" << elapsed;
    json << "}";
    std::cout << json.str();
    return 0;
}

int main(int argc, char *argv[])
{
    if (argc < 4)
    {
        std::cerr << "Usage: huffzip-ai <compress|decompress|analyze|xref-parse> <input> <output>" << std::endl;
        return 1;
    }

    std::string command = argv[1];
    std::string inputPath = argv[2];
    std::string outputPath = argv[3];

    if (command == "compress")
    {
        return compressFile(inputPath, outputPath);
    }
    if (command == "decompress")
    {
        return decompressFile(inputPath, outputPath);
    }
    if (command == "analyze")
    {
        return analyzeFile(inputPath);
    }
    if (command == "xref-parse")
    {
        return parseXrefFile(inputPath, outputPath);
    }

    std::cerr << "Unknown command" << std::endl;
    return 1;
}
