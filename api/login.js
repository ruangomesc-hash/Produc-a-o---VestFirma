import { dispatchVestfirmaApi } from './vestfirma-dispatch.mjs'

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
}

export default function handler(req, res) {
  return dispatchVestfirmaApi(req, res)
}
