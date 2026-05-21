#include "aes_codec.h"

#include "engine_util.h"

#include <array>
#include <cstring>

#if defined(_WIN32)
#define NOMINMAX
#include <windows.h>
#include <bcrypt.h>
#pragma comment(lib, "bcrypt.lib")
#endif

bool aes_is_available()
{
#if defined(_WIN32)
    return true;
#else
    return false;
#endif
}

#if defined(_WIN32)

static bool derive_key(const std::string &password, std::array<BYTE, 32> &key)
{
    const char *seed = "huffzip-ai-master-key";
    BCRYPT_ALG_HANDLE alg = nullptr;
    if (BCryptOpenAlgorithmProvider(&alg, BCRYPT_SHA256_ALGORITHM, nullptr, BCRYPT_ALG_HANDLE_HMAC_FLAG) != 0)
    {
        return false;
    }

    DWORD hash_len = 0;
    DWORD data_len = 0;
    BCryptGetProperty(alg, BCRYPT_HASH_LENGTH, reinterpret_cast<PUCHAR>(&hash_len), sizeof(hash_len), &data_len, 0);

    std::vector<BYTE> hash(hash_len);
    if (BCryptCreateHash(alg, nullptr, nullptr, 0, reinterpret_cast<PUCHAR>(const_cast<char *>(seed)), static_cast<ULONG>(strlen(seed)), 0) != 0)
    {
        BCryptCloseAlgorithmProvider(alg, 0);
        return false;
    }

    BCRYPT_HASH_HANDLE hash_handle = nullptr;
    if (BCryptCreateHash(alg, &hash_handle, nullptr, 0, reinterpret_cast<PUCHAR>(const_cast<char *>(seed)), static_cast<ULONG>(strlen(seed)), 0) != 0)
    {
        BCryptCloseAlgorithmProvider(alg, 0);
        return false;
    }

    if (BCryptHashData(hash_handle, reinterpret_cast<PUCHAR>(const_cast<char *>(password.data())), static_cast<ULONG>(password.size()), 0) != 0)
    {
        BCryptDestroyHash(hash_handle);
        BCryptCloseAlgorithmProvider(alg, 0);
        return false;
    }

    if (BCryptFinishHash(hash_handle, hash.data(), hash_len, 0) != 0)
    {
        BCryptDestroyHash(hash_handle);
        BCryptCloseAlgorithmProvider(alg, 0);
        return false;
    }

    BCryptDestroyHash(hash_handle);
    BCryptCloseAlgorithmProvider(alg, 0);

    std::memcpy(key.data(), hash.data(), std::min<std::size_t>(32, hash.size()));
    return true;
}

bool aes_encrypt_file(const std::string &input_path, const std::string &output_path, const std::string &password)
{
    ByteVector plain;
    if (!engine_read_file(input_path, plain))
    {
        return false;
    }

    std::array<BYTE, 32> key{};
    if (!derive_key(password, key))
    {
        return false;
    }

    BCRYPT_ALG_HANDLE alg = nullptr;
    if (BCryptOpenAlgorithmProvider(&alg, BCRYPT_AES_ALGORITHM, nullptr, 0) != 0)
    {
        return false;
    }

    if (BCryptSetProperty(alg, BCRYPT_CHAINING_MODE, reinterpret_cast<PUCHAR>(const_cast<wchar_t *>(BCRYPT_CHAIN_MODE_GCM)), sizeof(BCRYPT_CHAIN_MODE_GCM), 0) != 0)
    {
        BCryptCloseAlgorithmProvider(alg, 0);
        return false;
    }

    BCRYPT_KEY_HANDLE key_handle = nullptr;
    if (BCryptGenerateSymmetricKey(alg, &key_handle, nullptr, 0, key.data(), static_cast<ULONG>(key.size()), 0) != 0)
    {
        BCryptCloseAlgorithmProvider(alg, 0);
        return false;
    }

    std::array<BYTE, 12> iv{};
    if (BCryptGenRandom(nullptr, iv.data(), static_cast<ULONG>(iv.size()), BCRYPT_USE_SYSTEM_PREFERRED_RNG) != 0)
    {
        BCryptDestroyKey(key_handle);
        BCryptCloseAlgorithmProvider(alg, 0);
        return false;
    }

    BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO auth_info;
    BCRYPT_INIT_AUTH_MODE_INFO(auth_info);
    std::array<BYTE, 16> tag{};
    auth_info.pbNonce = iv.data();
    auth_info.cbNonce = static_cast<ULONG>(iv.size());
    auth_info.pbTag = tag.data();
    auth_info.cbTag = static_cast<ULONG>(tag.size());

    ByteVector cipher(plain.size());
    ULONG produced = 0;
    if (BCryptEncrypt(key_handle, plain.data(), static_cast<ULONG>(plain.size()), &auth_info, nullptr, 0, cipher.data(), static_cast<ULONG>(cipher.size()), &produced, 0) != 0)
    {
        BCryptDestroyKey(key_handle);
        BCryptCloseAlgorithmProvider(alg, 0);
        return false;
    }

    BCryptDestroyKey(key_handle);
    BCryptCloseAlgorithmProvider(alg, 0);

    ByteVector packed;
    packed.insert(packed.end(), {'H', 'Z', 'A', 'E'});
    packed.insert(packed.end(), iv.begin(), iv.end());
    packed.insert(packed.end(), tag.begin(), tag.end());
    packed.insert(packed.end(), cipher.begin(), cipher.begin() + produced);
    return engine_write_file(output_path, packed);
}

bool aes_decrypt_file(const std::string &input_path, const std::string &output_path, const std::string &password)
{
    ByteVector packed;
    if (!engine_read_file(input_path, packed) || packed.size() < 32)
    {
        return false;
    }

    if (packed[0] != 'H' || packed[1] != 'Z' || packed[2] != 'A' || packed[3] != 'E')
    {
        return false;
    }

    std::array<BYTE, 12> iv{};
    std::array<BYTE, 16> tag{};
    std::memcpy(iv.data(), packed.data() + 4, iv.size());
    std::memcpy(tag.data(), packed.data() + 16, tag.size());
    ByteVector cipher(packed.begin() + 32, packed.end());

    std::array<BYTE, 32> key{};
    if (!derive_key(password, key))
    {
        return false;
    }

    BCRYPT_ALG_HANDLE alg = nullptr;
    if (BCryptOpenAlgorithmProvider(&alg, BCRYPT_AES_ALGORITHM, nullptr, 0) != 0)
    {
        return false;
    }

    if (BCryptSetProperty(alg, BCRYPT_CHAINING_MODE, reinterpret_cast<PUCHAR>(const_cast<wchar_t *>(BCRYPT_CHAIN_MODE_GCM)), sizeof(BCRYPT_CHAIN_MODE_GCM), 0) != 0)
    {
        BCryptCloseAlgorithmProvider(alg, 0);
        return false;
    }

    BCRYPT_KEY_HANDLE key_handle = nullptr;
    if (BCryptGenerateSymmetricKey(alg, &key_handle, nullptr, 0, key.data(), static_cast<ULONG>(key.size()), 0) != 0)
    {
        BCryptCloseAlgorithmProvider(alg, 0);
        return false;
    }

    BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO auth_info;
    BCRYPT_INIT_AUTH_MODE_INFO(auth_info);
    auth_info.pbNonce = iv.data();
    auth_info.cbNonce = static_cast<ULONG>(iv.size());
    auth_info.pbTag = tag.data();
    auth_info.cbTag = static_cast<ULONG>(tag.size());

    ByteVector plain(cipher.size());
    ULONG produced = 0;
    if (BCryptDecrypt(key_handle, cipher.data(), static_cast<ULONG>(cipher.size()), &auth_info, nullptr, 0, plain.data(), static_cast<ULONG>(plain.size()), &produced, 0) != 0)
    {
        BCryptDestroyKey(key_handle);
        BCryptCloseAlgorithmProvider(alg, 0);
        return false;
    }

    BCryptDestroyKey(key_handle);
    BCryptCloseAlgorithmProvider(alg, 0);

    plain.resize(produced);
    return engine_write_file(output_path, plain);
}

#else

bool aes_encrypt_file(const std::string &, const std::string &, const std::string &)
{
    return false;
}

bool aes_decrypt_file(const std::string &, const std::string &, const std::string &)
{
    return false;
}

#endif
