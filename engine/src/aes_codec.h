#ifndef AES_CODEC_H
#define AES_CODEC_H

#include <string>

bool aes_encrypt_file(const std::string &input_path, const std::string &output_path, const std::string &password);
bool aes_decrypt_file(const std::string &input_path, const std::string &output_path, const std::string &password);
bool aes_is_available();

#endif
