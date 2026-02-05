# Project Clean - Quick Start Guide

Project Clean is a local-first AI content moderation system. Follow these steps to set it up on your local machine (Windows or Linux).

## Prerequisites

1.  **Node.js**: Install Node.js (v18 or higher) from [nodejs.org](https://nodejs.org/).
2.  **Git**: Install Git from [git-scm.com](https://git-scm.com/).
3.  **Python**: (Optional but recommended for some AI libraries) Install Python 3.10+ from [python.org](https://python.org/).

## Installation Steps (Windows & Linux)

1.  **Clone the Repository**:
    ```bash
    git clone <your-repository-url>
    cd project-clean
    ```

2.  **Install Dependencies**:
    Open your terminal (Command Prompt, PowerShell, or Bash) and run:
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**:
    Create a file named `.env` in the root directory and add the following:
    ```env
    JWT_SECRET=your_super_secret_key_here
    PORT=5000
    ```
    *(Note: For offline use, the system defaults to in-memory storage, so no database URL is required initially.)*

4.  **Start the Application**:
    ```bash
    npm run dev
    ```

5.  **Access the App**:
    Open your browser and navigate to `http://localhost:5000`.

## Demo Credentials

- **Admin**: `admin@projectclean.com` / `admin`
- **Moderator**: `moderator@projectclean.com` / `moderator`
- **User**: `user@projectclean.com` / `user`

## Features & Usage

- **Social Demo**: Post content in English or Hindi. The AI will automatically analyze it for violations (hate speech, spam, etc.).
- **Admin Dashboard**: View real-time statistics, manage users, and review flagged content.
- **Offline AI**: All processing happens locally on your machine using optimized models.
