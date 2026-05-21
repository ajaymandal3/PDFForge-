#include "deflate_codec.h"

#include "engine_util.h"

#if defined(ENGINE_HAS_ZLIB)
#include <zlib.h>
#endif

bool deflate_is_available()
{
#if defined(ENGINE_HAS_ZLIB)
    return true;
#else
    return false;
#endif
}

#if defined(ENGINE_HAS_ZLIB)

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

bool deflate_compress_file(const std::string &input_path, const std::string &output_path, std::string &file_name_out)
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

    uLong bound = compressBound(static_cast<uLong>(input.size()));
    ByteVector compressed(bound);
    uLongf compressed_size = bound;

    if (compress2(compressed.data(), &compressed_size, input.data(), static_cast<uLong>(input.size()), Z_BEST_COMPRESSION) != Z_OK)
    {
        return false;
    }

    compressed.resize(compressed_size);

    ByteVector output = {'D', 'F', 'L', 'Z'};
    output.push_back(1);
    write_u16(output, static_cast<std::uint16_t>(file_name.size()));
    output.insert(output.end(), file_name.begin(), file_name.end());
    write_u64(output, static_cast<std::uint64_t>(input.size()));
    output.insert(output.end(), compressed.begin(), compressed.end());

    file_name_out = file_name;
    return engine_write_file(output_path, output);
}

bool deflate_decompress_file(const std::string &input_path, const std::string &output_path, std::string &file_name_out)
{
    ByteVector input;
    if (!engine_read_file(input_path, input))
    {
        return false;
    }

    if (input.size() < 4 || input[0] != 'D' || input[1] != 'F' || input[2] != 'L' || input[3] != 'Z')
    {
        return false;
    }

    std::size_t offset = 5;
    const std::uint16_t name_len = read_u16(input, offset);
    file_name_out.assign(input.begin() + static_cast<std::ptrdiff_t>(offset), input.begin() + static_cast<std::ptrdiff_t>(offset + name_len));
    offset += name_len;
    const std::uint64_t original_size = read_u64(input, offset);

    ByteVector payload(input.begin() + static_cast<std::ptrdiff_t>(offset), input.end());
    ByteVector output(static_cast<std::size_t>(original_size));
    uLongf output_size = static_cast<uLongf>(output.size());

    if (uncompress(output.data(), &output_size, payload.data(), static_cast<uLong>(payload.size())) != Z_OK)
    {
        return false;
    }

    output.resize(output_size);
    return engine_write_file(output_path, output);
}

#else

bool deflate_compress_file(const std::string &, const std::string &, std::string &)
{
    return false;
}

bool deflate_decompress_file(const std::string &, const std::string &, std::string &)
{
    return false;
}

#endif
