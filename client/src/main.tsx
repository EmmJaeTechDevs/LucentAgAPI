// Minimal frontend entry point for build compatibility
// This is a backend-only Express API project
import React from 'react'
import ReactDOM from 'react-dom/client'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div>
      <h1>Express API Backend</h1>
      <p>This is a backend-only Express API. Please refer to the API documentation at <a href="/api-docs">/api-docs</a></p>
    </div>
  </React.StrictMode>,
)