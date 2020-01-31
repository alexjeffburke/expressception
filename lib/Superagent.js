const http = require("http");
const qs = require("qs");

const types = {
  html: "text/html",
  json: "application/json",
  xml: "text/xml",
  urlencoded: "application/x-www-form-urlencoded",
  form: "application/x-www-form-urlencoded",
  "form-data": "application/x-www-form-urlencoded"
};

function decodeResError(res) {
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

  async end(callback) {
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

    const { res, errorPassedToNext } = await this._execute({ request });

    res.status = res.statusCode;

    if (callback) {
      callback(decodeResError(res), res);
    } else if (errorPassedToNext) {
      throw errorPassedToNext;
    }
  }
}

module.exports = Superagent;
