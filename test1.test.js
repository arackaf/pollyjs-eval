const { expect } = require("@jest/globals");
const fetch = require("node-fetch");
const NodeHttpAdapter = require("@pollyjs/adapter-node-http");
global.fetch = fetch;

const { Polly } = require("@pollyjs/core");
const FetchAdapter = require("@pollyjs/adapter-fetch");

Polly.register(NodeHttpAdapter);

const booksQuery = (asc) =>
  encodeURIComponent(`{
  allBooks(SORT: {title: ${asc ? 1 : -1}}) {
    Books {
      _id
      isbn
      title
      authors
    }
  }
}`).trim();

describe("test suite 1", () => {
  it("should work", async () => {
    const books = await fetch(
      `https://mylibrary.io/graphql-public?query=%7B%0A%20%20allBooks(SORT%3A%20%7Btitle%3A%201%7D)%20%7B%0A%20%20%20%20Books%20%7B%0A%20%20%20%20%20%20_id%0A%20%20%20%20%20%20isbn%0A%20%20%20%20%20%20title%0A%20%20%20%20%20%20authors%0A%20%20%20%20%7D%0A%20%20%7D%0A%7D%0A`
    ).then((resp) => resp.json());

    const polly = new Polly("X", {
      adapters: ["node-http"],
    });
    const { server } = polly;

    server.get("https://mylibrary.io/graphql-public?query=*").intercept((req, res) => {
      const asc = /\{title:\s*1\}/.test(decodeURIComponent(req.query.query));
      const result = {
        data: {
          allBooks: {
            Books: asc ? [{ title: "Book A" }] : [{ title: "Book Z" }],
          },
        },
      };
      res.status(200).json(result);
    });

    const booksAsc = await fetch(`https://mylibrary.io/graphql-public?query=${booksQuery(true)}`).then((res) => res.json());
    const booksDesc = await fetch(`https://mylibrary.io/graphql-public?query=${booksQuery(false)}`).then((res) => res.json());

    expect(booksAsc.data.allBooks.Books[0].title).toBe("Book A");
    expect(booksDesc.data.allBooks.Books[0].title).toBe("Book Z");
  });
});
