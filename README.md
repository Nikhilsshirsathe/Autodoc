
# AUTODOC – AI-Powered Automation for SME IPO Document Preparation

## Overview

AUTODOC is an AI-powered platform designed to simplify and automate the documentation process for Small and Medium Enterprises (SMEs) preparing for an Initial Public Offering (IPO).

Preparing for an IPO involves collecting, organizing, reviewing, and verifying large volumes of financial, legal, and corporate documents. This information is often scattered across multiple files and formats, making the process time-consuming and difficult to manage.

AUTODOC addresses this challenge through intelligent document processing, a centralized company knowledge base, and a Retrieval-Augmented Generation (RAG) chatbot that enables users to retrieve relevant company information and generate structured IPO-related documentation.

The platform aims to improve document accessibility, information retrieval, and the overall efficiency of SME IPO preparation.

---

## Problem Statement

SMEs face several challenges during IPO preparation:

- Financial, legal, and corporate documents are scattered across different sources and formats.
- Manually reviewing and organizing large volumes of documents is time-consuming.
- Extracting accurate information from complex documents and tables can be challenging.
- Finding specific information across multiple documents requires significant manual effort.
- Preparing structured IPO documentation involves repetitive work and careful verification.

## Our Solution

AUTODOC provides an integrated AI-powered document intelligence platform that helps organize company information, retrieve relevant context, and assist in preparing IPO-related documents.

The platform combines OCR, document parsing, knowledge base development, and RAG-based information retrieval to make company documentation more accessible and structured.

---

## Key Features

### 1. Intelligent Document Processing

- Supports the processing of financial, legal, and corporate documents.
- Uses OCR to extract text from document-based information.
- Identifies and processes document structures, including tables and layouts.
- Converts unstructured information into organized, usable data.

### 2. Centralized Company Knowledge Base

- Organizes extracted information into a centralized knowledge base.
- Maintains document-related context and metadata.
- Enables semantic retrieval of relevant information.
- Uses vector-based search to retrieve information based on meaning rather than only exact keyword matches.

### 3. RAG-Based AI Chatbot

- Allows users to interact with their company documents through natural-language queries.
- Retrieves relevant information from the knowledge base before generating responses.
- Provides context-aware answers based on available company documentation.
- Helps users find specific financial, legal, and corporate information efficiently.

### 4. IPO Draft Generation

- Assists in preparing structured IPO-related documentation.
- Uses available company information as context for generating relevant content.
- Reduces repetitive manual documentation work.
- Supports human review and verification of generated information.

### 5. Collaboration and Document Management

- Provides a centralized environment for managing IPO-related information.
- Supports a more organized documentation workflow.
- Aims to improve accessibility and coordination during the IPO preparation process.

---

## Technology Stack

### Frontend
- Next.js
- React.js
- TypeScript
- Tailwind CSS

### Backend
- Python
- FastAPI

### AI and LLM
- Sarvam 30B – Large Language Model
- LangChain – LLM application development and RAG orchestration
- LangGraph – Stateful AI workflow orchestration

### Document Intelligence
- Surya OCR – Optical Character Recognition
- IBM Docling – Document parsing, layout understanding, and structured information extraction

### Database and Storage
- PostgreSQL
- pgvector – Vector storage and similarity search
- Redis – Caching and performance support

---

## System Workflow

1. **Document Upload:** Users provide financial, legal, and corporate documents.
2. **Document Processing:** OCR and document parsing technologies extract text and structured information.
3. **Data Preparation:** Extracted content is cleaned, organized, and divided into meaningful chunks.
4. **Knowledge Base Development:** Relevant document information is converted into embeddings and stored for retrieval.
5. **User Query:** Users ask questions through the AI-powered chatbot.
6. **Context-Aware Retrieval:** The RAG pipeline retrieves relevant information from the company knowledge base.
7. **Response Generation:** The LLM uses the retrieved context to generate relevant responses.
8. **IPO Documentation:** The platform assists in generating structured IPO-related content for review and verification.

---

## RAG Pipeline

AUTODOC uses Retrieval-Augmented Generation (RAG) to provide context-aware responses based on company-specific documentation.

The RAG pipeline involves:

- **Document Ingestion:** Processing uploaded documents and extracting relevant content.
- **Text Chunking:** Dividing documents into smaller, meaningful sections.
- **Embedding Generation:** Converting text chunks into numerical vector representations.
- **Vector Storage:** Storing embeddings using PostgreSQL and pgvector.
- **Semantic Retrieval:** Finding relevant document chunks based on the user's query.
- **Contextual Generation:** Providing retrieved information to the LLM to generate grounded responses.

This approach helps the chatbot answer company-specific questions using available documentation rather than relying only on the model's general knowledge.

---

## Setup and Execution Instructions

Follow the steps below to set up and run the AUTODOC application locally.

### Prerequisites

Make sure the following tools are installed:

- Python 3.10+
- Node.js and npm
- PostgreSQL
- Git

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <repository-name>
```

### 2. Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

Create and activate a virtual environment.

**Windows:**

```bash
python -m venv venv
venv\Scripts\activate
```

**Linux/macOS:**

```bash
python3 -m venv venv
source venv/bin/activate
```

Install the required dependencies:

```bash
pip install -r requirements.txt
```

Configure the required environment variables in a `.env` file according to the project's configuration.

Start the FastAPI server:

```bash
uvicorn main:app --reload
```

The backend server will be available at:

```text
http://127.0.0.1:8000
```

FastAPI documentation can be accessed at:

```text
http://127.0.0.1:8000/docs
```

### 3. Frontend Setup

Open a new terminal and navigate to the frontend directory:

```bash
cd frontend
```

Install the dependencies:

```bash
npm install
```

Configure the required frontend environment variables in the `.env.local` file.

Start the development server:

```bash
npm run dev
```

The frontend application will be available at:

```text
http://localhost:3000
```

### 4. Database Configuration

- Configure PostgreSQL and create the required database.
- Set the database connection details in the backend environment variables.
- Ensure the pgvector extension is enabled if required by the database schema.
- Apply the project's database migrations or initialization scripts, if provided.

### 5. Access the Application

Once both frontend and backend servers are running, open the frontend URL in your browser and start using AUTODOC.

**Note:** Update the directory names, environment variables, database setup, and backend startup command according to the actual project repository.

---

## Results and Outcomes

AUTODOC demonstrates how AI-powered document intelligence and Retrieval-Augmented Generation can simplify the SME IPO documentation workflow.

The project delivers the following outcomes:

- **Centralized Document Management:** Provides an organized approach to managing financial, legal, and corporate documents.
- **Automated Information Extraction:** Uses OCR and document parsing technologies to extract information from uploaded documents.
- **Structured Knowledge Base:** Organizes extracted information to support efficient storage and retrieval.
- **Context-Aware AI Chatbot:** Enables users to ask natural-language questions and retrieve relevant information from company documents using RAG.
- **Semantic Information Retrieval:** Uses vector embeddings and similarity search to identify relevant document content based on query meaning.
- **AI-Assisted IPO Documentation:** Supports the preparation of structured IPO-related content using available company information.
- **Improved Accessibility:** Reduces the effort required to locate and understand information spread across multiple documents.

### Overall Impact

AUTODOC brings document processing, knowledge management, and AI-powered information retrieval into a unified platform.

It demonstrates the potential of combining OCR, LLMs, vector databases, and RAG pipelines to make SME IPO documentation more structured, accessible, and efficient.

The platform is designed to reduce repetitive manual effort while keeping human review and verification an important part of the documentation process.

---

## Future Scope

- Enhanced financial data extraction and validation.
- Improved document verification and consistency checks.
- Advanced source traceability for generated responses.
- More comprehensive collaboration and review workflows.
- Stronger access control and enterprise-level security.
- Integration with additional document formats and IPO preparation workflows.

---

## Target Users

- Small and Medium Enterprises (SMEs)
- IPO consultants
- Financial and legal professionals
- Company secretaries
- Documentation and compliance teams

---


## Conclusion

AUTODOC aims to make SME IPO preparation more organized and efficient by bringing document intelligence, centralized knowledge management, and context-aware AI assistance into a unified platform.

By combining OCR, document parsing, RAG, and LLM-based generation, the platform helps transform scattered company documents into accessible and structured information that supports the IPO preparation process.
