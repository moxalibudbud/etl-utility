# 📦 Description

A lightweight ETL library built in Typescript, optimized for processing large flat files such as CSV, TXT, and DOT. It supports reading files either locally or directly from cloud blob storage, using the efficient `readline` stream interface to handle large datasets without consuming too much memory.

## 🔧 Features

- Stream-based processing using Node.js `readline`
- Supports local files and blob storage (e.g., Azure Blob)
- Configurable options:
  - Input and output fields
  - Field separator
  - Filename filters
  - Field-to-field mapping

## 🧠 Use Case

This library is designed for **stocktake and cycle count operations**, especially in enterprise environments where data is sourced from large ERPs like:

- Oracle
- SAP
- Microsoft Dynamics AX

## ❓ Why Flat Files?

While APIs are useful, ERPs often export large datasets (e.g., product master files) via flat files due to the volume of data—commonly reaching **500MB or more**. Streaming such data via APIs is technically possible but not ideal.

Flat files transmitted through **SFTP** or **blob storage** are a more reliable approach in these scenarios. This library consumes those files efficiently and performs the necessary ETL transformations without loading the entire file into memory.

## 🧩 Integration & Usage

This library is flexible and can be integrated into:

- Existing Node.js applications
- **Serverless functions** triggered by storage events or queues
- **BullMQ workers** that process scheduled or on-demand jobs
- **Workflow engines** like **n8n**, where it can be wrapped as a custom function
- Any JavaScript/TypeScript environment that needs ETL capabilities for flat files

> ⚠️ **Note:** This library is not yet production-ready. It currently serves as a boilerplate based on real-world customer requirements.

## 🚧 Improvements (Planned)

- 📘 Add complete documentation and examples
- ⚙️ Add support for more ETL options and validation rules

## Developer Note

The following environment variables are required

```
AZURE_BLOB_STORAGE_ACCOUNT_NAME
AZURE_BLOB_STORAGE_ACCOUNT_KEY
```

## Todo

Need to document the module usage from the following files

- /etl
- /file-generator
- /line-data
- /types

## Commit guidelines

Reference: https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#-git-commit-guidelines
