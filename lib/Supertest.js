const http = require("http");
const proxyquire = require("proxyquire");

const Superagent = require("./Superagent");

let Test;
try {
  require("supertest");

  Test = proxyquire("supertest/lib/test", {
    superagent: Superagent
  });
} catch (e) {
  Test = null;
}

class Supertest {
  constructor(executeFn) {
    if (Test === null) {
      throw new Error("supertest is not installed");
    }
    this._agent = new Superagent(executeFn);
    this._flags = this._agent._flags;
  }

  _createTest(method, url) {
    this._flags.method = method;
    this._flags.path = url;
    const test = new Test("", "", "", "");
    test._agent = this._agent;
    test._flags = this._flags;
    return test;
  }

  agent() {
    const agent = Superagent.agent();

    // lift and apply TestAgent trick from supertest
    http.METHODS.forEach(method => {
      method = method.toLowerCase();
      const self = this;
      agent[method] = function(url, fn) {
        const req = self._createTest(method, url);
        req.ca(this._ca);
        req.cert(this._cert);
        req.key(this._key);

        req.on("response", this._saveCookies.bind(this));
        req.on("redirect", this._saveCookies.bind(this));
        req.on("redirect", this._attachCookies.bind(this, req));

        this._attachCookies(req);
        this._setDefaults(req);

        return req;
      };
    });

    return agent;
  }

  delete(url) {
    return this._createTest("delete", url);
  }

  del(url) {
    return this.delete(url);
  }

  get(url) {
    return this._createTest("get", url);
  }

  head(url) {
    return this._createTest("head", url);
  }

  post(url) {
    return this._createTest("post", url);
  }

  put(url) {
    return this._createTest("put", url);
  }
}

module.exports = Supertest;
