const CookieJar = require("cookiejar");
const http = require("http");
const proxyquire = require("proxyquire");
const qs = require("qs");
const util = require("util");

function createTimeoutError() {
  const error = new Error();
  error.name = "TimeoutError";
  return error;
}

function decodeResError(res, metadata, error) {
  if (error) {
    return error;
  }
  if (metadata.isDestroyed) {
    return new Error("destroyed");
  }

  const isOkResponse = res.status >= 200 && res.status < 300;
  if (isOkResponse) {
    return null;
  }
  let msg = "Unsuccessful HTTP response";
  if (res) {
    msg = http.STATUS_CODES[res.status] || msg;
  }
  const err = new Error(msg);
  err.status = res ? res.status : undefined;
  return err;
}

function isRedirect(code) {
  return [301, 302, 303, 305, 307, 308].includes(code);
}

class Superagent {
  constructor(options, executeFn) {
    if (Superagent.Request === null) {
      throw new Error("superagent is not installed");
    }

    options = options || {};

    this._defaults = options.defaults || {};
    this._executeFn = executeFn;
    this._flags = {
      timeout: 0,
      body: null,
      type: null,
      method: null,
      path: null,
      query: null,
      headers: null
    };
  }

  async _execute({ timeout, ...options }) {
    const promises = [this._executeFn(options)];
    if (timeout > 0) {
      promises.push(
        new Promise((resolve, reject) => {
          setTimeout(() => reject(createTimeoutError()), timeout);
        })
      );
    }
    let error = null;
    try {
      await Promise.race(promises);
    } catch (e) {
      error = e;
    }
    return { context: await promises[0], error };
  }

  agent() {
    const agent = Superagent.agent();

    // lift and apply TestAgent trick from supertest
    http.METHODS.forEach(method => {
      method = method.toLowerCase();
      const self = this;
      agent[method] = function(url, fn) {
        const req = self[method](url);
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
    return new Superagent.Request(this, "DELETE", url);
  }

  del(url) {
    return this.delete(url);
  }

  get(url) {
    return new Superagent.Request(this, "GET", url);
  }

  head(url) {
    return new Superagent.Request(this, "HEAD", url);
  }

  post(url) {
    return new Superagent.Request(this, "POST", url);
  }

  put(url) {
    return new Superagent.Request(this, "PUT", url);
  }
}

let Request;
try {
  ({ Request } = require("superagent"));
} catch (e) {
  Request = null;
}

Superagent.Request = (function() {
  if (Request === null) {
    return null;
  }

  function decorateRequest(req) {
    req._headers = req.headers;

    Object.defineProperty(req, "path", {
      get: () => {
        console.warn(".path does not behave like node (appended query string)");
        return req.url;
      }
    });
  }

  function decorateResponse(res, httpResponse) {
    res.status = res.statusCode;
    const httpResponseHeaders = httpResponse.headers;

    // XXX: questionnable default behaviour of superagent
    if (!httpResponseHeaders.get("content-type")) {
      httpResponseHeaders.set("content-type", "text/html");
    }

    const proxiedHeaders = new Proxy(Object.create(null), {
      get: (_, prop) => {
        // protect the proxy against inspection
        if (typeof prop !== "string") return;
        return httpResponseHeaders.get(prop);
      }
    });
    res.header = proxiedHeaders;
    res.headers = proxiedHeaders;
    res.body = httpResponse.body;

    let text = null;
    if (typeof res.body === "string") {
      text = res.body;
    } else if (Buffer.isBuffer(res.body)) {
      try {
        text = res.body.toString();
      } catch (e) {}
    } else {
      try {
        text = JSON.stringify(res.body);
      } catch (e) {}
    }
    res.text = text || "";
  }

  function SuperagentRequest(agent, ...rest) {
    const hasAgent = agent instanceof Superagent;
    if (!hasAgent) {
      rest.unshift(agent);
    }
    const [method, url] = rest;
    Request.call(this, method, url);
    if (hasAgent) {
      this.setAgent(agent);
    }
  }

  util.inherits(SuperagentRequest, Request);

  SuperagentRequest.prototype.setAgent = function(agent) {
    this.__agent = agent;
    const defaults = this.__agent._defaults || {};
    for (const [key, value] of Object.entries(defaults.headers || {})) {
      this.set(key, value);
    }
  };

  // stubs for superagent
  SuperagentRequest.prototype.request = function() {};

  // promise support
  SuperagentRequest.prototype.then = function(resolve, reject) {
    if (this._promise) {
      return this._promise;
    }

    this._promise = new Promise((resolve, reject) => {
      this.end((err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    });

    return this._promise.then(resolve, reject);
  };

  SuperagentRequest.prototype.catch = function(reject) {
    return this.then(undefined, reject);
  };

  SuperagentRequest.prototype._end = async function() {
    let body;
    if (this._formData) {
      body = this._formData;
    } else if (this._data) {
      body = this._data;
    } else {
      body = undefined;
    }

    // add cookies
    if (this.cookies) {
      if (Object.prototype.hasOwnProperty.call(this._header, "cookie")) {
        // merge
        const tmpJar = new CookieJar.CookieJar();
        tmpJar.setCookies(this._header.cookie.split(";"));
        tmpJar.setCookies(this.cookies.split(";"));
        this.set(
          "cookie",
          tmpJar.getCookies(CookieJar.CookieAccessInfo.All).toValueString()
        );
      } else {
        this.set("cookie", this.cookies);
      }
    }

    // handle query parameters supplied as objects
    if (Object.keys(this.qs).length > 0) {
      this.url += `?${qs.stringify(this.qs, { arrayFormat: "repeat" })}`;
    }

    // append query parameters supplied as strings
    this._finalizeQueryString();

    const request = {
      url: this.url,
      method: this.method || "GET",
      headers: this._header,
      body
    };

    this.emit("request", this);

    let timeout = this._timeout;
    if (typeof timeout !== "number" || timeout < 0) {
      timeout = 0;
    }

    const { context, error } = await this.__agent._execute({
      timeout,
      request
    });
    const { req, res, metadata, httpResponse, errorPassedToNext } = context;

    decorateRequest(req);
    decorateResponse(res, httpResponse);
    this.req = req;
    this.res = res;

    // redirect
    const redirect = isRedirect(res.statusCode);
    if (redirect && this._redirects++ !== this._maxRedirects) {
      const resForRedirect = {
        headers: res.headers,
        resume: () => {},
        statusCode: res.statusCode
      };
      return this._redirect(resForRedirect);
    }

    this.emit("response", res);

    if (errorPassedToNext) {
      if (errorPassedToNext.UnexpectedExpressError) {
        return this.callback(errorPassedToNext.data.error);
      } else {
        throw errorPassedToNext;
      }
    }

    this.callback(decodeResError(res, metadata, error), res);
  };

  return SuperagentRequest;
})();

try {
  if (Request === null) {
    throw new Error();
  }

  Superagent.agent = proxyquire("superagent/lib/node/agent", {
    "../..": Superagent,
    methods: http.METHODS.map(method => method.toLowerCase())
  });
} catch (e) {
  Object.defineProperty(Superagent, "agent", {
    get: () => {
      throw new Error("superagent is not installed");
    }
  });
}

module.exports = Superagent;
