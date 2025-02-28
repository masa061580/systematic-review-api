require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェアの設定
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // フロントエンドファイルを提供
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000'
}));
// OpenAI API エンドポイント
app.post('/api/openai', async (req, res) => {
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', req.body, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('OpenAI API エラー:', error.response?.data || error.message);
    res.status(500).json({ error: 'OpenAI APIリクエストに失敗しました' });
  }
});

// PubMed 検索 API エンドポイント
app.get('/api/pubmed/search', async (req, res) => {
  try {
    const { term } = req.query;
    const response = await axios.get(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi`, {
      params: {
        term,
        retmax: req.query.retmax || 30,
        format: 'json',
        api_key: process.env.PUBMED_API_KEY
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('PubMed API エラー:', error.response?.data || error.message);
    res.status(500).json({ error: 'PubMed検索リクエストに失敗しました' });
  }
});

// PubMed サマリー API エンドポイント
app.get('/api/pubmed/summary', async (req, res) => {
  try {
    const { id } = req.query;
    const response = await axios.get(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi`, {
      params: {
        id,
        format: 'json',
        api_key: process.env.PUBMED_API_KEY
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('PubMed API エラー:', error.response?.data || error.message);
    res.status(500).json({ error: 'PubMedサマリーリクエストに失敗しました' });
  }
});

app.listen(PORT, () => {
  console.log(`サーバーが http://localhost:${PORT} で実行中...`);
});