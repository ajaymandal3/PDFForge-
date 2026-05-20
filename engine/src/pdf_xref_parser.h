#ifndef PDF_XREF_PARSER_H
#define PDF_XREF_PARSER_H

#include <stddef.h>

#ifdef __cplusplus
extern "C"
{
#endif

    typedef struct PdfXrefEntry
    {
        int object_id;
        int generation;
        size_t byte_offset;
        int in_use;
    } PdfXrefEntry;

    typedef struct PdfXrefMap
    {
        PdfXrefEntry *entries;
        size_t count;
        size_t capacity;
        int *keys;
        size_t *indexes;
        unsigned char *states;
        size_t bucket_count;
    } PdfXrefMap;

    typedef struct PdfXrefTable
    {
        PdfXrefMap map;
        size_t xref_offset;
        size_t startxref_offset;
        size_t trailer_offset;
        size_t subsection_count;
    } PdfXrefTable;

    void pdf_xref_table_init(PdfXrefTable *table);
    void pdf_xref_table_free(PdfXrefTable *table);
    int pdf_xref_parse(const unsigned char *bytes, size_t size, PdfXrefTable *table, char *error, size_t error_size);

#ifdef __cplusplus
}
#endif

#endif