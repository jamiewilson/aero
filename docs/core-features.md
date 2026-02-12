## Core Stack

| Tool       | Role                             | Why It Helps                                           |
| ---------- | -------------------------------- | ------------------------------------------------------ |
| **Vite**   | Dev server & bundler             | Fast HMR, plugin system, handles asset bundling        |
| **Nitro**  | Server engine                    | Universal deployment, server routes, prerendering      |
| **HTMX**   | Client/Server interactivity      | Enables dynamic HTML updates without full page reloads |
| **Alpine** | Lightweight JavaScript framework | Provides declarative UI interactions and templating    |

Links:

- [Vite Repo](https://github.com/vitejs/vite) / [Vite Docs](https://vitejs.dev/guide/)
- [Nitro Repo](https://github.com/nitrojs/nitro) / [Nitro Docs](https://v3.nitro.build/)
- [htmx Repo](https://github.com/bigskysoftware/htmx) / [htmx Docs](https://htmx.org/docs/)
- [Alpine Repo](https://github.com/alpinejs/alpine) / [Alpine Docs](https://alpinejs.dev/start-here)


## Core Idea

This is mostly a static site generator and custom template engine that favors using **markup that is as close to native HTML as possible**. By default it compiles to a static site 

It provides a way to create a simple server alongside your static site, compiles your html files and bundles assets. The resulting HTML and assets are served by the Nitro server. 

Some of the core needs are a templating engine with a way to pass data to the components and layouts in a structured manner. 

At build time:
- Parse HTML and scripts
- Run on:build scripts, compile on:client to js
- Compose templates and pass data and build static pages

On the client:
- Aside from injecting server data at build time into pages and Alpine, all of the htmx and alpine references are copied to the client as-is (i.e. there shouldn't be any need to process these at build time as they are made to run on the client).


# Goals/Questions/Concerns

- Reduce as much custom code as possible while still achieving the desired api for the templates. What current open soure solutions are there to create the template engine?
- Everything needs to feel and work like native html (can this eliminate the need for custom file types, IDE extensions, etc.)
- Need to make sure syntax and conventions work well with htmx and alpine, as this is meant to be the prefered stack (but usage of these tools should not be necessary). For example, is it best to use the following syntax for evaluating expressions in html like this: `<div data-props="title: 'Example'">`, `<li data-for="link in site.meta.footer.links">` or does it make things better/easier to require `{}` such as: `<li data-for="{ link in site.meta.footer.links }">`

