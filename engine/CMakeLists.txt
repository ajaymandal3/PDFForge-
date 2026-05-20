cmake_minimum_required(VERSION 3.16)
project(huffzip_ai VERSION 1.0 LANGUAGES C CXX)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(huffzip-ai
	src/main.cpp
	src/pdf_xref_parser.c
)

target_include_directories(huffzip-ai PRIVATE src)
