const qs = require("qs");

const types = {
  html: "text/html",
  json: "application/json",
  xml: "text/xml",
  urlencoded: "application/x-www-form-urlencoded",
  form: "application/x-www-form-urlencoded",
  "form-data": "application/x-www-form-urlencoded"
};

class Superagent {
  constructor(executeFn) {
    this._execute = executeFn;
    this._flags = {
      body: null,
      type: null,
      method: null,
      path: null,
      query: null,
      headers: null
    };
  }

  del(url) {
    this._flags.method = "DELETE";
    this._flags.path = url;
    return this;
  }

  get(url) {
    this._flags.method = "GET";
    this._flags.path = url;
    return this;
  }

  post(url) {
    this._flags.method = "POST";
    this._flags.path = url;
    return this;
  }

  put(url) {
    this._flags.method = "PUT";
    this._flags.path = url;
    return this;
  }

  query(object) {
    this._flags.query = object;
    return this;
  }

  send(object) {
    if (typeof object === "string" && this._flags.type === "application/json") {
      object = JSON.parse(object);
    }
    this._flags.body = object;
    return this;
  }

  set(headerName, headerValue) {
    this._flags.headers = this._flags.headers || {};
    this._flags.headers[headerName] = headerValue;
  }

  type(type) {
    this._flags.type = types[type] || type;
    this.set("Content-Type", this._flags.type);
    return this;
  }

  async expect(statusCode) {
    const flags = this._flags;
    const query = flags.query ? qs.stringify(flags.query) : "";
    const headers = flags.headers || undefined;
    const body = flags.body || undefined;
    const request = {
      url: `${flags.path}${query ? `?${query}` : ""}`,
      method: flags.method || "GET",
      headers,
      body
    };
    const response = {
      statusCode
    };

    const context = await this._execute({ request, response });

    if (context.res.statusCode !== statusCode) {
      throw new Error("Mismatching status code.");
    }

    return context.res;
  }
}

module.exports = Superagent;
