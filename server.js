require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// CORSの設定を一元化
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000'
}));

// 1. サーバー側のCORS設定を修正
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://masa061580.github.io',
    'https://masa061580.github.io/systematic-review-assistant/',
    'https://masa061580.github.io/systematic-review-assistant'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. プリフライトリクエスト (OPTIONS) への対応を明示的に追加
app.options('*', cors());

// ミドルウェアの設定
app.use(express.json());
app.use(express.static('public')); // フロントエンドファイルを提供

// OpenAI API エンドポイント
app.post('/api/openai', async (req, res) => {
  try {
    // リクエストボディのバリデーション
    if (!req.body || !req.body.messages) {
      return res.status(400).json({ error: '不正なリクエストボディです' });
    }

    const response = await axios.post('https://api.openai.com/v1/chat/completions', req.body, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      timeout: 10000 // タイムアウトを追加
    });
    res.json(response.data);
  } catch (error) {
    console.error('OpenAI API エラー:', error.response?.data || error.message);
    
    // より詳細なエラーハンドリング
    if (error.response) {
      // APIからのエラーレスポンス
      res.status(error.response.status).json({ 
        error: 'OpenAI APIリクエストに失敗しました',
        details: error.response.data 
      });
    } else if (error.request) {
      // リクエストは送信されたが、レスポンスがない
      res.status(503).json({ error: 'サービスが利用できません' });
    } else {
      // リクエスト送信前のエラー
      res.status(500).json({ error: '内部サーバーエラー' });
    }
  }
});

// PubMed 検索 API エンドポイント
app.get('/api/pubmed/search', async (req, res) => {
  try {
    const { term } = req.query;

    // 検索キーワードのバリデーション
    if (!term || term.trim() === '') {
      return res.status(400).json({ error: '検索キーワードが必要です' });
    }

    const response = await axios.get(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi`, {
      params: {
        term,
        retmax: Math.min(parseInt(req.query.retmax) || 30, 100), // 最大件数を制限
        format: 'json',
        api_key: process.env.PUBMED_API_KEY
      },
      timeout: 10000 // タイムアウトを追加
    });
    res.json(response.data);
  } catch (error) {
    console.error('PubMed検索 API エラー:', error.response?.data || error.message);
    
    if (error.response) {
      res.status(error.response.status).json({ 
        error: 'PubMed検索リクエストに失敗しました',
        details: error.response.data 
      });
    } else if (error.request) {
      res.status(503).json({ error: 'サービスが利用できません' });
    } else {
      res.status(500).json({ error: '内部サーバーエラー' });
    }
  }
});

// PubMed サマリー API エンドポイント
app.get('/api/pubmed/summary', async (req, res) => {
  try {
    const { id } = req.query;

    // IDのバリデーション
    if (!id || !/^\d+$/.test(id)) {
      return res.status(400).json({ error: '無効なPubMed IDです' });
    }

    const response = await axios.get(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi`, {
      params: {
        id,
        format: 'json',
        api_key: process.env.PUBMED_API_KEY
      },
      timeout: 10000 // タイムアウトを追加
    });
    res.json(response.data);
  } catch (error) {
    console.error('PubMed サマリー API エラー:', error.response?.data || error.message);
    
    if (error.response) {
      res.status(error.response.status).json({ 
        error: 'PubMedサマリーリクエストに失敗しました',
        details: error.response.data 
      });
    } else if (error.request) {
      res.status(503).json({ error: 'サービスが利用できません' });
    } else {
      res.status(500).json({ error: '内部サーバーエラー' });
    }
  }
});

// 未定義のルートハンドリング
app.use((req, res) => {
  res.status(404).json({ error: 'エンドポイントが見つかりません' });
});

// グローバルエラーハンドラー
app.use((err, req, res, next) => {
  console.error('未処理のエラー:', err);
  res.status(500).json({ error: '予期せぬエラーが発生しました' });
});

app.listen(PORT, () => {
  console.log(`サーバーが http://localhost:${PORT} で実行中...`);
});