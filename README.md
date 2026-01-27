# Emojic 🤯

> A chaotic, emoji-based C transpiler and IDE. Write C code using emojis, compile it, or transform normal C into a cursed emoji nightmare.


## What is this?

**Emojic** is a dangerous experiment in compiler theory. It allows you to write valid C code using emojis as preprocessor definitions. It comes with a full-stack **Emojic Studio** IDE that lets you:

1.  **Compile Emojic to C**: Turn `😒 😊😂🤣👌` into `int main()`.
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
    git clone [https://github.com/notamitgamer/](https://github.com/notamitgamer/)emojic.git
    cd emojic
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
#define 👌 {
#define 😘 }

😒 😊😂🤣👌
    ❤️😂"Hello World!\n"🤣😍
    🙌 0😍
😘
```

## 🤝 Contributing

We welcome chaos! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
