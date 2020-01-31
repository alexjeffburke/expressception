const expect = require("unexpected");
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

    return expect(() => agent.post("/foo/bar").expect(201), "to be fulfilled");
  });

  it("should work with a middleware", () => {
    const middleware = (req, res) => {
      res.status(201).send();
    };
    const agent = expressception(middleware).superagent();

    return expect(() => agent.post("/foo/bar").expect(201), "to be fulfilled");
  });

  describe("with superagent api", () => {
    it("should support query", () => {
      const agent = expressception((req, res) => {
        res.status(req.query.foo === "bar" ? 200 : 400).send();
      }).superagent();

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

    it("should support send", () => {
      const agent = expressception(
        express()
          .use(express.json())
          .post("/foo/bar", (req, res) => {
            res.status(req.body.foo === "bar" ? 200 : 400).send();
          })
      ).superagent();

      return expect(
        () =>
          agent
            .post("/foo/bar")
            .type("json")
            .send({
              foo: "bar"
            })
            .expect(200),
        "to be fulfilled"
      );
    });

    it("should fail on mismatched status code", () => {
      const agent = expressception((req, res) => {
        res.status(204).send();
      }).superagent();

      return expect(
        () => agent.post("/foo/bar").expect(201),
        "to be rejected with",
        "Mismatching status code."
      );
    });
  });
});
