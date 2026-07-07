import React from 'react'
import { createRoot } from 'react-dom/client'
import NovelManager from '../NovelManager'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <NovelManager mode="popup" />
  </React.StrictMode>,
)
