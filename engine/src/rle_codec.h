#ifndef RLE_CODEC_H
#define RLE_CODEC_H

#include "engine_util.h"
#include <string>

bool rle_compress_file(const std::string &input_path, const std::string &output_path, std::string &file_name_out);
bool rle_decompress_file(const std::string &input_path, const std::string &output_path, std::string &file_name_out);

#endif
