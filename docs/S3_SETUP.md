# S3 Upload Integration

The app's `FileUpload` component (product images, user avatars, write-off
evidence) uploads to Amazon S3 through a **presign endpoint** you host once.
Until it's configured, small files (< 300 KB) are stored inline as data URLs
in the database, so nothing breaks out of the box.

## 1. Create the bucket

- S3 bucket (e.g. `prtmgmt-uploads`), region of your choice.
- Block public access OFF for the `uploads/` prefix, or serve via CloudFront.
- CORS configuration on the bucket:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

(Restrict `AllowedOrigins` to your UI Bakery app origin in production.)

## 2. Deploy the presigner (Lambda + Function URL)

Node.js 20 Lambda with an IAM role allowing `s3:PutObject` on the bucket:

```js
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const BUCKET = process.env.BUCKET;
const REGION = process.env.AWS_REGION;
const s3 = new S3Client({ region: REGION });

export const handler = async (event) => {
  const { filename, contentType } = JSON.parse(event.body || '{}');
  const key = `uploads/${Date.now()}-${(filename || 'file').replace(/[^\w.\-]/g, '_')}`;
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 }
  );
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadUrl,
      publicUrl: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`,
    }),
  };
};
```

- Enable a **Function URL** (auth type NONE, or IAM + CloudFront in front).
- Configure CORS on the Function URL: allow origin `*` (tighten later),
  methods `POST`, headers `content-type`.
- IMPORTANT: do NOT also return an `Access-Control-Allow-Origin` header from
  the handler — the Function URL CORS config adds its own, and duplicated
  headers make browsers reject the response ("fetch failed").

## 3. Point the app at it

Settings → Users & Planning → **Integrations**: paste the Function URL into
**S3 Presign Endpoint** and save. All uploads now go to S3 and the public
object URL is stored in the relevant `*_file` column.

## Notes

- No AWS credentials ever live in the app or repo — only the endpoint URL.
- The endpoint returns `{ uploadUrl, publicUrl }`; any backend that honors
  that contract works (API Gateway, Cloudflare Worker + R2, etc.).
