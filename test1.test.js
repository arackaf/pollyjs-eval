const { expect } = require("@jest/globals");
const path = require("path");
const fetch = require("node-fetch");
const NodeHttpAdapter = require("@pollyjs/adapter-node-http");
global.fetch = fetch;

const { Polly } = require("@pollyjs/core");
const FetchAdapter = require("@pollyjs/adapter-fetch");
const FSPersister = require("@pollyjs/persister-fs");
//const { setupPolly } = require("setup-polly-jest");

Polly.register(NodeHttpAdapter);
Polly.register(FSPersister);

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
  let polly;
  let server;
  beforeAll(() => {
    // context.polly.configure({ recordIfMissing: true });
    polly = new Polly("PolyEval", {
      adapters: ["node-http"],
      flushRequestsOnStop: true,
      logging: false,
      matchRequestsBy: {
        headers: false,
        order: false,
      },
      mode: "replay",
      recordIfMissing: true,
      persister: "fs",
      persisterOptions: {
        fs: {
          recordingsDir: path.resolve(__dirname, "__recordings__"),
        },
      },
    });
    ({ server } = polly);
  });

  afterAll(async () => {
    await polly.flush();
    await polly.stop();
  });

  it("should record network requests I've haven't manually mocked", async () => {
    server
      .get("https://mylibrary.io/graphql-public?query=%7B%0A%20%20allBooks")
      .filter((req) => /allBooks/.test(req.query.query))
      .intercept((req, res) => {
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

    // manually mocked
    const booksAsc = await fetch(`https://mylibrary.io/graphql-public?query=${booksQuery(true)}`).then((res) => res.json());
    // manually mocked
    const booksDesc = await fetch(`https://mylibrary.io/graphql-public?query=${booksQuery(false)}`).then((res) => res.json());

    // not manually mocked - will record
    const subjectsData = await fetch(
      `https://mylibrary.io/graphql-public?query=query%7BallSubjects(name_startsWith%3A%22Hist%22)%7BSubjects%7Bname%7D%7D%7D`
    ).then((res) => res.json());

    expect(booksAsc.data.allBooks.Books[0].title).toBe("Book A");
    expect(booksDesc.data.allBooks.Books[0].title).toBe("Book Z");
    expect(subjectsData.data.allSubjects.Subjects[0].name).toBe("History");
  });
});
