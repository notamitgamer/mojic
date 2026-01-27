import os
from datetime import datetime

# --- CONFIGURATION ---
PROJECT_NAME = "Emojic"
REPO_NAME = "emojic"
DESCRIPTION = "A chaotic, emoji-based C transpiler and IDE. Write C code using emojis, compile it, or transform normal C into a cursed emoji nightmare."
AUTHOR_NAME = "Amit Dutta" # Based on your uploaded files
AUTHOR_EMAIL = "amitdutta4255@gmail.com"
LICENSE_TYPE = "MIT"
YEAR = datetime.now().year

# --- TEMPLATES ---

README_TEMPLATE = f"""# {PROJECT_NAME} 🤯

> {DESCRIPTION}

![Emojic Banner](https://via.placeholder.com/1200x400/0f0f11/eab308?text=Emojic+Studio)

## What is this?

**{PROJECT_NAME}** is a dangerous experiment in compiler theory. It allows you to write valid C code using emojis as preprocessor definitions. It comes with a full-stack **Emojic Studio** IDE that lets you:

1.  **Compile Emojic to C**: Turn `😒 😊😂🤣👌` into `int main() {{`.
2.  **Transform C to Emojic**: Turn your clean code into an unreadable emoji mess.
3.  **Run in Cloud**: Execute your cursed code instantly via the `compiler.amit.is-a.dev` backend.

## 🚀 Features

- **Dynamic Token Analysis**: Automatically detects keywords in your C code.
- **Custom Mapping**: Choose which emojis represent `int`, `return`, or `;`.
- **Live Terminal**: Real-time output streaming via WebSockets.
- **Dark Mode IDE**: A VS Code-like experience in the browser.

## 🛠️ Installation & Deployment

This project is designed to be deployed on **Vercel** (Frontend + API).

1.  **Clone the repo**
    ```bash
    git clone [https://github.com/notamitgamer/](https://github.com/notamitgamer/){REPO_NAME}.git
    cd {REPO_NAME}
    ```

2.  **Install Backend Dependencies**
    ```bash
    pip install -r requirements.txt
    ```

3.  **Run Locally**
    ```bash
    python api/index.py
    # Open index.html in your browser
    ```

## 😒 Example Code

```c
/* The Hello World of Emojic */
#include<stdio.h>

#define 😒 int
#define 😊 main
#define 😂 (
#define 🤣 )
#define ❤️ printf
#define 😍 ;
#define 🙌 return
#define 👌 {{
#define 😘 }}

😒 😊😂🤣👌
    ❤️😂"Hello World!\\n"🤣😍
    🙌 0😍
😘
```

## 🤝 Contributing

We welcome chaos! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the {LICENSE_TYPE} License - see the [LICENSE](LICENSE) file for details.
"""

CONTRIBUTING_TEMPLATE = f"""# Contributing to {PROJECT_NAME}

First off, thanks for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to {PROJECT_NAME}. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report for {PROJECT_NAME}. Following these guidelines helps maintainers and the community understand your report, reproduce the behavior, and find related reports.

* **Use a clear and descriptive title** for the issue to identify the problem.
* **Describe the exact steps which reproduce the problem** in as many details as possible.
* **Provide specific examples** to demonstrate the steps.

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for {PROJECT_NAME}, including completely new features and minor improvements to existing functionality.

* **Use a clear and descriptive title** for the issue to identify the suggestion.
* **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
* **Explain why this enhancement would be useful** to most {PROJECT_NAME} users.

## Styleguides

### Git Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line

### Emojic Code Style

* If you are writing Emojic examples, try to make them as unreadable as possible.
* Use `😒` for `int` whenever possible.

Happy Hacking! 🚀
"""

SECURITY_TEMPLATE = f"""# Security Policy

## Supported Versions

Use the most recent version of {PROJECT_NAME}.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously, even if this project is a joke.

If you discover a security vulnerability within {PROJECT_NAME}, please send an e-mail to **{AUTHOR_EMAIL}**. All security vulnerabilities will be promptly addressed.

**Please do not open public issues for security vulnerabilities.**
"""

CODE_OF_CONDUCT_TEMPLATE = f"""# Contributor Covenant Code of Conduct

## Our Pledge

In the interest of fostering an open and welcoming environment, we as contributors and maintainers pledge to making participation in our project and our community a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

## Our Standards

Examples of behavior that contributes to creating a positive environment include:

* Using welcoming and inclusive language
* Being respectful of differing viewpoints and experiences
* Gracefully accepting constructive criticism
* Focusing on what is best for the community
* Showing empathy towards other community members

Examples of unacceptable behavior by participants include:

* The use of sexualized language or imagery and unwelcome sexual attention or advances
* Trolling, insulting/derogatory comments, and personal or political attacks
* Public or private harassment
* Publishing others' private information, such as a physical or electronic address, without explicit permission
* Other conduct which could reasonably be considered inappropriate in a professional setting

## Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported by contacting the project team at **{AUTHOR_EMAIL}**. All complaints will be reviewed and investigated and will result in a response that is deemed necessary and appropriate to the circumstances. The project team is obligated to maintain confidentiality with regard to the reporter of an incident.

## Attribution

This Code of Conduct is adapted from the [Contributor Covenant][homepage], version 1.4, available at [http://contributor-covenant.org/version/1/4][version]

[homepage]: http://contributor-covenant.org
[version]: http://contributor-covenant.org/version/1/4/
"""

LICENSE_TEMPLATE = f"""MIT License

Copyright (c) {YEAR} {AUTHOR_NAME}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""

# --- GENERATION ---

def generate_file(filename, content):
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content.strip())
    print(f"✅ Generated {filename}")

def main():
    print(f"Generating documentation for {PROJECT_NAME}...")
    
    generate_file("README.md", README_TEMPLATE)
    generate_file("CONTRIBUTING.md", CONTRIBUTING_TEMPLATE)
    generate_file("SECURITY.md", SECURITY_TEMPLATE)
    generate_file("CODE_OF_CONDUCT.md", CODE_OF_CONDUCT_TEMPLATE)
    generate_file("LICENSE", LICENSE_TEMPLATE)
    
    print("\nAll done! Your repo is ready to be dangerous.")

if __name__ == "__main__":
    main()