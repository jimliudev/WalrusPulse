# WalrusPulse

A **Walrus-native feedback and form platform** that enables teams and communities to collect structured feedback directly on-chain.

Built for the Walrus ecosystem — every form schema and submission is stored permanently on [Walrus](https://walrus.xyz) decentralised storage and registered on the [Sui](https://sui.io) blockchain.

---

## Features

| Feature | Details |
|---|---|
| **Custom Form Builder** | Drag-and-drop field editor with reordering |
| **Field Types** | Short text, long text, dropdown, checkboxes, star rating, URL, file upload, image upload |
| **Walrus Storage** | Schema JSON and all responses stored as Walrus blobs |
| **On-chain Registry** | Sui Move contract tracks all forms and response blob IDs |
| **Shareable Links** | One URL per form — anyone with a Sui wallet can respond |
| **Admin Dashboard** | Filter, review, and prioritise feedback across all your forms |
| **CSV Export** | Download all responses as a CSV file in one click |

---

## Tech Stack

- **Frontend**: Vite + React + TypeScript + Tailwind CSS + Shadcn UI
- **Blockchain**: Sui (Move contract) + `@mysten/dapp-kit`
- **Storage**: Walrus decentralised storage
- **DnD**: `@dnd-kit`
- **Data**: `@tanstack/react-query`

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Deploy the Move contract

```bash
cd contracts/walrus_pulse
sui client publish --gas-budget 100000000
```

Copy the **Package ID** from the output.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_PACKAGE_ID=0x<your-package-id>
VITE_SUI_NETWORK=testnet
VITE_WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
VITE_WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
```

### 4. Run the app

```bash
npm run dev
```

---

### 5. Create form refer data.

```json
{
  "formTitle": "Walrus Developer Experience & Ecosystem Feedback",
  "description": "Help us improve the Walrus protocol and developer tools by sharing your integration experience.",
  "fields": [
    {
      "id": "q1",
      "type": "star",
      "label": "Overall Developer Experience (DX)",
      "description": "How smooth was your journey from setup to deployment?",
      "required": true
    },
    {
      "id": "q2",
      "type": "text",
      "label": "Technical Challenges",
      "description": "Please describe any bottlenecks you encountered with the SDK or Walrus Sites configuration.",
      "required": true
    },
    {
      "id": "q3",
      "type": "video",
      "label": "Product Demo / Bug Report",
      "description": "Upload a short video showcasing your product or a specific issue you found.",
      "required": false
    },
    {
      "id": "q4",
      "type": "url",
      "label": "Project Repository",
      "description": "Provide a link to your public GitHub repository for review.",
      "required": true
    }
  ]
}
```

## How it works

```
Builder Page
  │
  ├── User builds form schema
  ├── Schema JSON → storeBlob() → Walrus blobId
  └── create_form(title, desc, schemaBlobId) → Sui Form object (shared)
                                                        │
                                              formObjectId in URL

Form Page  /form/:formObjectId
  │
  ├── Fetch Form object from Sui → schemaBlobId
  ├── Fetch schema JSON from Walrus
  ├── User fills out form
  ├── Answers JSON → storeBlob() → Walrus responseBlobId
  └── submit_response(formObj, responseBlobId) → appended on-chain

Admin Dashboard
  │
  ├── Query FormCreated events filtered by wallet address
  ├── Fetch each Form object → response_blob_ids[]
  ├── Fetch each response JSON from Walrus
  ├── Render in table
  └── Export CSV
```

---

## Project Structure

```
WalrusPulse/
├── contracts/walrus_pulse/          # Sui Move package
│   ├── Move.toml
│   └── sources/walrus_pulse.move
├── src/
│   ├── components/
│   │   ├── ui/                      # Button, Card, Toast, Badge…
│   │   ├── FieldEditor.tsx          # Form builder field editor
│   │   ├── FieldRenderer.tsx        # Form viewer field renderer
│   │   ├── Navbar.tsx
│   │   └── StarRating.tsx
│   ├── lib/
│   │   ├── walrus.ts                # storeBlob / readBlob
│   │   ├── sui.ts                   # buildCreateFormTx / fetchFormObject
│   │   └── csv.ts                   # buildCSV / downloadCSV
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── BuilderPage.tsx
│   │   ├── FormPage.tsx
│   │   └── AdminPage.tsx
│   ├── types/index.ts
│   └── config.ts
└── package.json
```

---

## Walrus API endpoints used

| Operation | Endpoint |
|---|---|
| Store blob | `PUT https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=5` |
| Read blob | `GET https://aggregator.walrus-testnet.walrus.space/v1/blobs/{blobId}` |

---

## License

MIT