#ifndef ENGINE_API_H
#define ENGINE_API_H

#ifdef __cplusplus
extern "C" {
#endif

#define ENGINE_OK 0
#define ENGINE_ERR -1
#define ENGINE_ERR_PDF_FALLBACK -2

typedef enum {
    ENGINE_COMPRESS_HUFFMAN = 0,
    ENGINE_COMPRESS_RLE = 1,
    ENGINE_COMPRESS_DEFLATE = 2,
} EngineCompressMode;

int engine_compress_file(const char *input_path, const char *output_path, EngineCompressMode mode, char *error, int error_size);
int engine_decompress_file(const char *input_path, const char *output_path, char *error, int error_size);
int engine_analyze_file(const char *input_path, char *json_out, int json_out_size);
int engine_xref_parse_file(const char *input_path, const char *output_path, char *error, int error_size);

int engine_encrypt_file(const char *input_path, const char *output_path, const char *password, char *error, int error_size);
int engine_decrypt_file(const char *input_path, const char *output_path, const char *password, char *error, int error_size);

/* pages_spec example: "1-3,5" (1-based). Uses stack parsing + page linked list. */
int engine_split_pdf(const char *input_path, const char *output_path, const char *pages_spec, char *error, int error_size);

/* input_paths: null-terminated array of paths, ends with NULL */
int engine_merge_pdfs(const char **input_paths, const char *output_path, char *error, int error_size);

#ifdef __cplusplus
}
#endif

#endif
