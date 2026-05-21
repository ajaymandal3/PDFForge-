#ifndef ENGINE_UTIL_H
#define ENGINE_UTIL_H

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

using Byte = unsigned char;
using ByteVector = std::vector<Byte>;

bool engine_read_file(const std::string &path, ByteVector &bytes);
bool engine_write_file(const std::string &path, const ByteVector &bytes);
bool engine_write_text_file(const std::string &path, const std::string &content);
void engine_set_error(char *error, int error_size, const std::string &message);
std::string engine_json_escape(const std::string &value);

#endif
