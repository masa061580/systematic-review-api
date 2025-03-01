require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// CORSの設定を強化
app.use(cors({
  origin: '*', // すべてのオリジンからのリクエストを許可（本番環境では絞る）
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// プリフライトリクエスト (OPTIONS) への対応
app.options('*', cors());

// ミドルウェアの設定
app.use(express.json());
app.use(express.static('public'));

// ルートエンドポイント（サーバー稼働確認用）
app.get('/', (req, res) => {
  res.send('Systematic Review API Server is running');
});

// サーバーの状態確認用エンドポイント
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// OpenAI API エンドポイント
app.post('/api/openai', async (req, res) => {
  try {
    // リクエストボディのバリデーション
    if (!req.body || !req.body.messages) {
      return res.status(400).json({ error: '不正なリクエストボディです' });
    }

    console.log('OpenAI APIリクエスト受信:', {
      model: req.body.model,
      messagesCount: req.body.messages.length
    });

    const response = await axios.post('https://api.openai.com/v1/chat/completions', req.body, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      timeout: 30000 // タイムアウトを30秒に延長
    });
    
    console.log('OpenAI APIレスポンス成功');
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

    console.log('PubMed検索リクエスト:', { term });

    const response = await axios.get(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi`, {
      params: {
        term,
        retmax: Math.min(parseInt(req.query.retmax) || 30, 100), // 最大件数を制限
        format: 'json',
        api_key: process.env.PUBMED_API_KEY
      },
      timeout: 15000 // タイムアウトを15秒に設定
    });
    
    console.log('PubMed検索レスポンス成功:', { count: response.data?.esearchresult?.count || 0 });
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
    if (!id || !/^[\d,]+$/.test(id)) {
      return res.status(400).json({ error: '無効なPubMed IDです' });
    }

    console.log('PubMed サマリーリクエスト:', { id });

    const response = await axios.get(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi`, {
      params: {
        id,
        format: 'json',
        api_key: process.env.PUBMED_API_KEY
      },
      timeout: 15000 // タイムアウトを15秒に設定
    });
    
    console.log('PubMed サマリーレスポンス成功');
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

// PubMed フェッチ API エンドポイント (抄録取得用) の修正版
app.get('/api/pubmed/fetch', async (req, res) => {
  try {
    const { id, rettype = 'abstract' } = req.query;

    // IDのバリデーション
    if (!id || !/^\d+$/.test(id)) {
      return res.status(400).json({ error: '無効なPubMed IDです' });
    }

    console.log('PubMed フェッチリクエスト:', { id, rettype });

    const response = await axios.get(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi`, {
      params: {
        db: 'pubmed',
        id,
        rettype,
        retmode: 'text',
        api_key: process.env.PUBMED_API_KEY
      },
      timeout: 15000 // タイムアウトを15秒に設定
    });
    
    // テキスト形式のレスポンスをパース
    const abstractText = response.data;
    
    console.log('PubMed フェッチレスポンス成功');
    
    // 抄録テキストをJSONとして返す
    res.json({ 
      pmid: id,
      abstract: abstractText
    });
  } catch (error) {
    console.error(`PubMed フェッチ API エラー:`, error.response?.data || error.message);
    
    // エラーが発生した場合でも空の抄録を返す（クライアント側でのエラー処理を容易にするため）
    res.json({ 
      pmid: id,
      abstract: ""
    });
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