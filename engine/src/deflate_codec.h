#ifndef DEFLATE_CODEC_H
#define DEFLATE_CODEC_H

#include <string>

bool deflate_compress_file(const std::string &input_path, const std::string &output_path, std::string &file_name_out);
bool deflate_decompress_file(const std::string &input_path, const std::string &output_path, std::string &file_name_out);
bool deflate_is_available();

#endif
