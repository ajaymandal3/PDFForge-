#ifndef PDF_OPS_H
#define PDF_OPS_H

#include <string>

int engine_split_pdf(const char *input_path, const char *output_path, const char *pages_spec, char *error, int error_size);
int engine_merge_pdfs(const char **input_paths, const char *output_path, char *error, int error_size);

#endif
