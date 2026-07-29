export default function handler(_req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(
    JSON.stringify({
      ok: true,
      ping: 'vestfirma-api',
      vercel: process.env.VERCEL === '1',
      hasBlob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      hasAdminPassword: Boolean(process.env.SEED_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD),
    }),
  )
}
