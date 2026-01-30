# Contributing to Mojic

First off, thanks for taking the time to contribute! 

The following is a set of guidelines for contributing to Mojic. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## Development Workflow

We use the standard GitHub Pull Request workflow.

1.  **Fork** the repository on GitHub:  
    [https://github.com/notamitgamer/mojic](https://github.com/notamitgamer/mojic)

2.  **Clone** your fork locally:
    ```bash
    git clone [https://github.com/YOUR_USERNAME/mojic.git](https://github.com/YOUR_USERNAME/mojic.git)
    cd mojic
    ```

3.  **Create a Branch** for your feature or bugfix:
    ```bash
    git checkout -b feature/amazing-feature
    ```

4.  **Install Dependencies**:
    ```bash
    npm install
    ```

5.  **Test your changes**:
    You can run the CLI locally using `npm start` or linking the package.
    ```bash
    # Run directly
    npm start -- encode test.c
    ```

6.  **Commit** your changes (see the style guide below).

7.  **Push** to your fork:
    ```bash
    git push origin feature/amazing-feature
    ```

8.  **Open a Pull Request** on the main repository (`notamitgamer/mojic`).

## How Can I Contribute?

### Reporting Bugs
* **Use a clear and descriptive title** for the issue to identify the problem.
* **Describe the exact steps which reproduce the problem** in as many details as possible.
* **Provide specific examples** to demonstrate the steps.

### Suggesting Enhancements
* **Use a clear and descriptive title** for the issue to identify the suggestion.
* **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
* **Explain why this enhancement would be useful** to most Mojic users.

## Styleguides

### Git Commit Messages
* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less

### Mojic Code Style
* **Cipher Logic:** Changes to `CipherEngine.js` must ensure backward compatibility with the header format if possible.
* **Streams:** Always use `StringDecoder` when handling text streams to prevent multi-byte emoji corruption.
* **Linting:** Ensure your code is clean and readable.

Happy Hacking! 
