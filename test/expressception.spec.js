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

    it("should fail on mismatched status code", () => {
      const agent = expressception((req, res) => {
        res.status(204).send();
      }).superagent();

      return expect(
        () => expect(agent.post("/foo/bar"), "to end with status code", 201),
        "to be rejected with",
        "Mismatching status code."
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
  });
});
