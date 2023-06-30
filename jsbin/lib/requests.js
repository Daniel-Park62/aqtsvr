const http = require('follow-redirects').http ;
const https = require('https')
const querystring = require('querystring');

const requests = {
  getContent(url, method = 'GET', headers = {}, bodyData = null) {
    return new Promise((resolve, reject) => {
      const lib = url.startsWith('https') ? https : http
      const urlObj = new URL(url)
      if (bodyData) {
        bodyData = requests.setContent(headers, bodyData)
      }
      const request = lib.request({
        headers,
        path: `${urlObj.pathname}${urlObj.search}`,
        host: urlObj.hostname,
        port: urlObj.port,
        method
      }, async (response) => {
        if (response.statusCode < 200 || response.statusCode > 299) {
          if (response.statusCode === 301) {
            request.end()
            resolve(await requests.redirect(response, method, headers))
            return
          } else {
            console.log(`Failed to load page, status code: ${response.statusCode}`)
          }
        }
        const bodyChunks = []
        response.on('data', chunk => bodyChunks.push(chunk))
        response.on('end', () => {
          const body = Buffer.concat(bodyChunks)
          if (response.headers) {
            const bodyResponse = body.toString('utf8')
            if (response.headers['content-type'].startsWith('application/json')) {
              try {
                resolve({ data: bodyResponse ? JSON.parse(bodyResponse) : undefined, headers: response.headers, code: response.statusCode })
              } catch (err) {
                console.error(err)
                resolve(undefined)
              }
            } else {
              resolve({ data: bodyResponse, headers: response.headers, code: response.statusCode })
            }
          }
        })
      })
      request.on('error', (err) => {
        console.error(err)
        reject(err)
      })
      if (bodyData) {
        request.write(bodyData)
      }
      request.end()
    })
  },

  setContent(headers, bodyData) {
    if (headers['content-type'] === "application/x-www-form-urlencoded" || headers['Content-Type'] === "application/x-www-form-urlencoded") {
      var form = querystring.stringify(bodyData)
      headers['content-length'] = form.length
      return form
    } else if ((headers['content-type'] && headers['content-type'].startsWith('application/json')) || (headers['Content-Type'] && headers['Content-Type'].startsWith('application/json')) || (headers['Content-type'] && headers['Content-type'].startsWith('application/json'))) {
      return JSON.stringify(bodyData)
    }
    return bodyData
  },

  async redirect(response, method, headers) {
    console.log(`Redirect to ${response.headers.location}`)
    var redirectUrl = response.headers.location
    if (redirectUrl && (redirectUrl.indexOf('http://') !== 0 || redirectUrl.indexOf('https://') !== 0)) {
      return await this.getContent(`${response.headers.location}`, method, headers)
    }
    return undefined
  },

  async getSize(url) {
    const result = await this.getContent(url, 'HEAD')
    return result.headers ? result.headers['content-length'] : undefined
  }
}

module.exports = requests