# **App Name**: CipherSuite

## Core Features:

- Project Workspace Management: Users can create, open, rename, and delete cybersecurity projects. Each project includes structured configuration settings (Project Name, Target, Scope, Start Date, End Date, Project Type). Upon creation, the system automatically initializes a structured workspace containing dedicated sections (Scope, Findings, Evidence, Logs, Notes, Reports) to ensure consistency and professional workflow.
- Findings Manager: The application provides a structured vulnerability management system. Users can create, edit, delete, search, and filter findings by severity. Each finding includes Title, Severity, Target, Description, Steps to Reproduce, Impact, Remediation, and Status. Findings automatically link to associated evidence for traceability.
- Evidence Manager: Users can upload and manage multiple types of evidence per project, including screenshots, log files, text files, HTTP request/response data, and terminal output. Evidence can be attached to specific findings and viewed directly within the application, with storage organized per project.
- Notes Editor: CipherSuite includes a dedicated security-focused notes environment for documenting research, methodology, and exploitation steps. Features include Markdown support, syntax-highlighted code blocks, terminal command formatting, one-click copy buttons, and searchable documentation. Notes are stored per project and structured for clarity.
- Log Manager: Users can upload or paste raw log data into a project-specific log section, providing basic viewing capabilities. The system stores logs per project and is designed for future expansion to include advanced parsing, filtering, and highlighting.
- AI Writing Assistant: CipherSuite integrates a specialized AI tool designed specifically for cybersecurity documentation. It assists with drafting professional vulnerability descriptions, expanding rough notes into structured findings, writing impact sections, generating remediation recommendations, and improving grammar and clarity. The tool understands cybersecurity terminology and produces client-ready language.
- Tool Output Importer: The system supports importing structured outputs from security tools like Nmap (XML), Nessus (XML), and Burp Suite (XML). Upon import, the system extracts relevant data (open ports, services, identified vulnerabilities), can suggest findings based on this data, and automatically links related output as supporting evidence.

## Style Guidelines:

- Primary Color: #6B4CC6. A rich, deep indigo-violet representing professionalism, technical depth, and focus. It should subtly stand out against the dark interface.
- Background Color: #17161A. A very dark, near-black background with a slight tonal depth to reduce eye strain and maintain a modern technical atmosphere suitable for extended use.
- Accent Color: #47C2FF. A vibrant cyan-blue used for interactive elements, highlights, notifications, and important UI indicators. It must contrast clearly against the dark background.
- Headline Font: Space Grotesk (sans-serif). Used for major section headers and titles. The style should feel modern, scientific, and structured.
- Body Font: Inter (sans-serif). Used for findings, descriptions, notes, and detailed content. Must prioritize readability and neutrality.
- Code Font: Source Code Pro (monospace). Used for code snippets, logs, terminal commands, and structured technical output to ensure alignment and clarity.
- Use clean, minimalist, line-based icons. Icons must clearly represent their function without visual clutter. The overall visual language should feel professional, precise, and modern.
- The application must use a modular, structured layout with a persistent left sidebar for primary navigation (Projects, Findings, Evidence, Logs, Notes, Reports, Settings) and a dynamic main content area. The interface should feel organized, purposeful, and built specifically for cybersecurity workflows.
- Animations must be subtle, fast, and functional. Focus on smooth state transitions and clear visual feedback. Avoid unnecessary motion or distractions. The user experience should feel efficient, responsive, and professional.