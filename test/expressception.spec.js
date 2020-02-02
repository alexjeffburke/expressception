const expect = require("unexpected").clone();
const express = require("express");

const expressception = require("../lib/expressception");

describe("expressception", () => {
  it("should be a function", () => {
    expect(expressception, "to be a function");
  });

  it("should work with an app", () => {
    const app = express().post("/foo/bar", (req, res) => {
      res.status(201).send();
    });
    const agent = expressception(app).superagent();

    return expect(
      run => agent.post("/foo/bar").end(run),
      "to call the callback without error"
    );
  });

  it("should work with a middleware", () => {
    const middleware = (req, res) => {
      res.status(201).send();
    };
    const agent = expressception(middleware).superagent();

    return expect(
      run => agent.post("/foo/bar").end(run),
      "to call the callback without error"
    );
  });

  it("should return an error if the response was destroyed", () => {
    const middleware = (req, res) => {
      res.destroy();
    };
    const agent = expressception(middleware).superagent();

    return expect(
      run => agent.post("/foo/bar").end(run),
      "to call the callback with error",
      "destroyed"
    );
  });

  describe("with superagent api", () => {
    expect.addAssertion(
      "<object> to end with status code <number>",
      (expect, agent, statusCode) => {
        const p = new Promise((resolve, reject) => {
          agent.end((err, res) => {
            if (err) {
              reject(err);
            } else {
              resolve(res);
            }
          });
        });

        return expect(p, "to be fulfilled").then(res => {
          if (res.status !== statusCode) {
            throw new Error("Mismatching status code.");
          }
        });
      }
    );

    it("should support query", () => {
      const agent = expressception((req, res) => {
        res.status(req.query.foo === "bar" ? 200 : 400).send();
      }).superagent();

      return expect(
        agent.get("/foo/bar").query({
          foo: "bar"
        }),
        "to end with status code",
        200
      );
    });

    it("should support send", () => {
      const agent = expressception(
        express()
          .use(express.json())
          .post("/foo/bar", (req, res) => {
            res.status(req.body.foo === "bar" ? 200 : 400).send();
          })
      ).superagent();

      return expect(
        agent
          .post("/foo/bar")
          .type("json")
          .send({
            foo: "bar"
          }),
        "to end with status code",
        200
      );
    });

    it("should allow being used as a promise (then)", async () => {
      const agent = expressception((req, res) => {
        res.status(204).send();
      }).superagent();

      const res = await agent.post("/foo/bar");

      return expect(res.status, "to equal", 204);
    });

    it("should allow being used as a promise (catch)", async () => {
      const agent = expressception((req, res) => {
        res.status(204).send();
      }).superagent();

      const res = await agent.post("/foo/bar").catch(e => {
        throw e;
      });

      return expect(res.status, "to equal", 204);
    });

    it("should allow chaining through set()", async () => {
      const agent = expressception((req, res) => {
        res
          .status(req.headers["content-type"] === "text/plain" ? 200 : 400)
          .send();
      }).superagent();

      const res = await agent
        .get("/")
        .set("content-type", "text/plain")
        .query({
          foo: "bar"
        });

      return expect(res.status, "to equal", 200);
    });

    it("should allow chaining through redirects", async () => {
      const agent = expressception((req, res) => {
        res.status(200).send();
      }).superagent();

      const res = await agent.get("/").redirects();

      return expect(res.status, "to equal", 200);
    });

    it('should allow retrieving "status"', async () => {
      const agent = expressception((req, res) => {
        res.status(201).send({});
      }).superagent();

      const res = await agent.post("/foo/bar");

      return expect(res.status, "to equal", 201);
    });

    it('should allow retrieving "header"', async () => {
      const agent = expressception((req, res) => {
        res.status(201).send({});
      }).superagent();

      const res = await agent.post("/foo/bar");

      return expect(
        res.header["content-type"],
        "to match",
        /application\/json/
      );
    });

    it('should allow retrieving "headers"', async () => {
      const agent = expressception((req, res) => {
        res.status(201).send({});
      }).superagent();

      const res = await agent.post("/foo/bar");

      return expect(
        res.headers["content-type"],
        "to match",
        /application\/json/
      );
    });

    it('should allow retrieving "body"', async () => {
      const agent = expressception((req, res) => {
        res.status(200).send({});
      }).superagent();

      const res = await agent.post("/foo/bar");

      return expect(res.body, "to equal", {});
    });

    it('should allow retrieving "text"', async () => {
      const agent = expressception((req, res) => {
        res.status(200).send("Hello");
      }).superagent();

      const res = await agent.get("/");

      return expect(res.text, "to equal", "Hello");
    });

    describe("methods", () => {
      ["delete", "del", "get", "head", "post", "put"].forEach(method => {
        it(`should allow ${method}()`, () => {
          const agent = expressception((req, res) => {
            res.status(200).send();
          }).superagent();

          return expect(agent[method]("/"), "to end with status code", 200);
        });
      });
    });

    describe("with options that are not supported", () => {
      it("should error if redirects(>0)", async () => {
        const agent = expressception((req, res) => {
          res.status(200).send();
        }).superagent();

        return expect(
          () => {
            agent.get("/").redirects(1);
          },
          "to throw",
          "redirects(value) with a value > 0 is not implemented"
        );
      });
    });
  });

  describe("with supertest api", () => {
    it("should support expect(status)", () => {
      const app = express().get("/foo/bar", (req, res) => {
        res.status(req.query.foo === "bar" ? 200 : 400).send();
      });
      const agent = expressception(app).supertest();

      return expect(
        () =>
          agent
            .get("/foo/bar")
            .query({
              foo: "bar"
            })
            .expect(200),
        "to be fulfilled"
      );
    });

    it("should support expect(header)", () => {
      const app = express().get("/foo/bar", (req, res) => {
        res.status(req.query.foo === "bar" ? 200 : 400).send({});
      });
      const agent = expressception(app).supertest();

      return expect(
        () =>
          agent
            .get("/foo/bar")
            .query({
              foo: "bar"
            })
            .expect("Content-Type", /json/),
        "to be fulfilled"
      );
    });

    it("should still allow .end() if used", () => {
      const agent = expressception((req, res) => {
        res.status(204).send();
      }).supertest();

      return expect(
        () => expect(agent.post("/foo/bar"), "to end with status code", 201),
        "to be rejected with",
        "Mismatching status code."
      );
    });

    it("should fail on mismatched status code", () => {
      const agent = expressception((req, res) => {
        res.status(204).send();
      }).supertest();

      return expect(
        () => agent.post("/foo/bar").expect(201),
        "to be rejected with",
        'expected 201 "Created", got 204 "No Content"'
      );
    });

    describe("methods", () => {
      ["delete", "del", "get", "head", "post", "put"].forEach(method => {
        it(`should allow ${method}()`, () => {
          const agent = expressception((req, res) => {
            res.status(200).send();
          }).supertest();

          return expect(agent[method]("/"), "to end with status code", 200);
        });
      });
    });
  });
});
