#include "engine_util.h"

#include <fstream>
#include <sstream>

bool engine_read_file(const std::string &path, ByteVector &bytes)
{
    std::ifstream file(path, std::ios::binary);
    if (!file)
    {
        return false;
    }

    bytes = ByteVector((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    return true;
}

bool engine_write_file(const std::string &path, const ByteVector &bytes)
{
    std::ofstream file(path, std::ios::binary);
    if (!file)
    {
        return false;
    }

    file.write(reinterpret_cast<const char *>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
    return static_cast<bool>(file);
}

bool engine_write_text_file(const std::string &path, const std::string &content)
{
    std::ofstream file(path, std::ios::binary);
    if (!file)
    {
        return false;
    }

    file << content;
    return static_cast<bool>(file);
}

void engine_set_error(char *error, int error_size, const std::string &message)
{
    if (!error || error_size <= 0)
    {
        return;
    }

    const std::size_t limit = static_cast<std::size_t>(error_size - 1);
    const std::size_t length = message.size() < limit ? message.size() : limit;
    message.copy(error, length);
    error[length] = '\0';
}

std::string engine_json_escape(const std::string &value)
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
