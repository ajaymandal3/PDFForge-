#include "rle_codec.h"

#include <algorithm>

static void write_u16(ByteVector &out, std::uint16_t value)
{
    out.push_back(static_cast<Byte>(value & 0xFF));
    out.push_back(static_cast<Byte>((value >> 8) & 0xFF));
}

static void write_u64(ByteVector &out, std::uint64_t value)
{
    for (int i = 0; i < 8; ++i)
    {
        out.push_back(static_cast<Byte>((value >> (8 * i)) & 0xFF));
    }
}

static std::uint16_t read_u16(const ByteVector &in, std::size_t &offset)
{
    std::uint16_t value = 0;
    for (int i = 0; i < 2; ++i)
    {
        value |= static_cast<std::uint16_t>(in[offset++]) << (8 * i);
    }
    return value;
}

static std::uint64_t read_u64(const ByteVector &in, std::size_t &offset)
{
    std::uint64_t value = 0;
    for (int i = 0; i < 8; ++i)
    {
        value |= static_cast<std::uint64_t>(in[offset++]) << (8 * i);
    }
    return value;
}

bool rle_compress_file(const std::string &input_path, const std::string &output_path, std::string &file_name_out)
{
    ByteVector input;
    if (!engine_read_file(input_path, input))
    {
        return false;
    }

    std::string file_name = input_path;
    const std::size_t slash = file_name.find_last_of("/\\");
    if (slash != std::string::npos)
    {
        file_name = file_name.substr(slash + 1);
    }

    ByteVector output = {'R', 'L', 'E', 'Z'};
    output.push_back(1);
    write_u16(output, static_cast<std::uint16_t>(file_name.size()));
    output.insert(output.end(), file_name.begin(), file_name.end());
    write_u64(output, static_cast<std::uint64_t>(input.size()));

    std::size_t index = 0;
    while (index < input.size())
    {
        std::size_t run = 1;
        while (index + run < input.size() && input[index + run] == input[index] && run < 65535)
        {
            ++run;
        }

        if (run >= 3)
        {
            write_u16(output, static_cast<std::uint16_t>(run));
            output.push_back(input[index]);
            index += run;
            continue;
        }

        std::size_t literal_start = index;
        std::size_t literal_count = 0;
        while (index < input.size() && literal_count < 65535)
        {
            std::size_t next_run = 1;
            while (index + next_run < input.size() && input[index + next_run] == input[index] && next_run < 65535)
            {
                ++next_run;
            }

            if (next_run >= 3)
            {
                break;
            }

            ++index;
            ++literal_count;
        }

        write_u16(output, static_cast<std::uint16_t>(literal_count | 0x8000));
        output.insert(output.end(), input.begin() + static_cast<std::ptrdiff_t>(literal_start), input.begin() + static_cast<std::ptrdiff_t>(literal_start + literal_count));
    }

    file_name_out = file_name;
    return engine_write_file(output_path, output);
}

bool rle_decompress_file(const std::string &input_path, const std::string &output_path, std::string &file_name_out)
{
    ByteVector input;
    if (!engine_read_file(input_path, input))
    {
        return false;
    }

    if (input.size() < 4 || input[0] != 'R' || input[1] != 'L' || input[2] != 'E' || input[3] != 'Z')
    {
        return false;
    }

    std::size_t offset = 5;
    const std::uint16_t name_len = read_u16(input, offset);
    file_name_out.assign(input.begin() + static_cast<std::ptrdiff_t>(offset), input.begin() + static_cast<std::ptrdiff_t>(offset + name_len));
    offset += name_len;
    const std::uint64_t original_size = read_u64(input, offset);

    ByteVector output;
    output.reserve(static_cast<std::size_t>(original_size));

    while (offset < input.size() && output.size() < original_size)
    {
        const std::uint16_t token = read_u16(input, offset);
        if (token & 0x8000)
        {
            const std::uint16_t literal_count = token & 0x7FFF;
            output.insert(output.end(), input.begin() + static_cast<std::ptrdiff_t>(offset), input.begin() + static_cast<std::ptrdiff_t>(offset + literal_count));
            offset += literal_count;
        }
        else
        {
            const std::uint16_t run = token;
            const Byte value = input[offset++];
            for (std::uint16_t i = 0; i < run && output.size() < original_size; ++i)
            {
                output.push_back(value);
            }
        }
    }

    if (output.size() > original_size)
    {
        output.resize(static_cast<std::size_t>(original_size));
    }

    return engine_write_file(output_path, output);
}
