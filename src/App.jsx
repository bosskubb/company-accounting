import React, { useState, useEffect, useMemo } from 'react';
import { 
  PieChart, List, PlusCircle, Download, Trash2, 
  TrendingUp, TrendingDown, DollarSign, ChevronLeft, ChevronRight, 
  Calendar, Sun, Moon, Camera, Image as ImageIcon, X,
  BarChart3, Search, Filter, Settings, Shield, Bell, Lock, Unlock, Send
} from 'lucide-react';

// --- Firebase Setup ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBxxxxxxx...",
  authDomain: "mycompany-accounting.firebaseapp.com",
  projectId: "mycompany-accounting",
  storageBucket: "mycompany-accounting.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdefg..."
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'company-accounting-app';

// --- Constants ---
const INCOME_CATEGORIES = ['ขายสินค้า', 'บริการ', 'ดอกเบี้ย/ปันผล', 'เงินทุน', 'อื่นๆ'];
const EXPENSE_CATEGORIES = ['ค่าอุปกรณ์/สินค้า', 'เงินเดือน/ค่าจ้าง', 'ค่าเช่า/น้ำ/ไฟ', 'ค่าเดินทาง', 'การตลาด/โฆษณา', 'สวัสดิการ', 'ภาษี/ค่าธรรมเนียม', 'อื่นๆ'];

export default function App() {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'transactions', 'analytics', 'settings'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Settings & Roles State
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [webhookUrl, setWebhookUrl] = useState(() => localStorage.getItem('company_webhook') || '');
  const [webhookTestStatus, setWebhookTestStatus] = useState('');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  // Dark Mode State
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') return window.matchMedia('(prefers-color-scheme: dark)').matches;
    return false;
  });

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    type: 'expense',
    category: EXPENSE_CATEGORIES[0],
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    receipt: null,
    recorderName: ''
  });
  const [isCompressing, setIsCompressing] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState(null);

  // 1. Authentication
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Data Fetching
  useEffect(() => {
    if (!user) return;
    const transactionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    const unsubscribe = onSnapshot(transactionsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date) || b.timestamp - a.timestamp);
      setTransactions(data);
      setLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // --- Helper Data ---
  const currentMonthString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const monthName = currentDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

  // Filtered & Searched Transactions
  const monthlyTransactions = useMemo(() => {
    return transactions
      .filter(t => t.date.startsWith(currentMonthString))
      .filter(t => filterCategory === 'all' || t.category === filterCategory)
      .filter(t => t.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                   (t.recorderName && t.recorderName.toLowerCase().includes(searchQuery.toLowerCase())));
  }, [transactions, currentMonthString, filterCategory, searchQuery]);

  const totals = useMemo(() => {
    let income = 0; let expense = 0;
    transactions.filter(t => t.date.startsWith(currentMonthString)).forEach(t => {
      if (t.type === 'income') income += Number(t.amount);
      if (t.type === 'expense') expense += Number(t.amount);
    });
    return { income, expense, profit: income - expense };
  }, [transactions, currentMonthString]);

  // Yearly Analytics Data
  const yearlyData = useMemo(() => {
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const data = months.map(m => ({ month: m, income: 0, expense: 0 }));
    let maxAmount = 0;

    transactions.filter(t => t.date.startsWith(`${selectedYear}-`)).forEach(t => {
      const monthIndex = parseInt(t.date.split('-')[1]) - 1;
      if (t.type === 'income') data[monthIndex].income += Number(t.amount);
      if (t.type === 'expense') data[monthIndex].expense += Number(t.amount);
    });

    data.forEach(d => {
      if (d.income > maxAmount) maxAmount = d.income;
      if (d.expense > maxAmount) maxAmount = d.expense;
    });

    return { data, maxAmount: maxAmount > 0 ? maxAmount : 1000 }; // fallback scale
  }, [transactions, selectedYear]);

  // --- Handlers ---
  const handleTypeChange = (type) => {
    setFormData(prev => ({
      ...prev,
      type,
      category: type === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]
    }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsCompressing(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; const MAX_HEIGHT = 800;
        let width = img.width; let height = img.height;
        if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
        else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        setFormData(prev => ({ ...prev, receipt: canvas.toDataURL('image/jpeg', 0.7) }));
        setIsCompressing(false);
      };
    };
  };

  const sendWebhookNotification = async (transaction) => {
    if (!webhookUrl) return;
    try {
      const message = `🔔 รายการใหม่: ${transaction.description}\nประเภท: ${transaction.type === 'income' ? 'รายรับ 🟢' : 'รายจ่าย 🔴'}\nหมวดหมู่: ${transaction.category}\nจำนวน: ${Number(transaction.amount).toLocaleString()} บาท\nผู้บันทึก: ${transaction.recorderName}`;
      
      // Attempt generic POST (works well with Make.com/Zapier webhooks)
      // Note: Direct LINE Notify API blocks browser CORS, so a middleman webhook is required.
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message, rawData: transaction })
      });
    } catch (err) {
      console.log("Webhook skipped or failed (CORS/Network error):", err);
    }
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!user || !formData.description || !formData.amount || !formData.recorderName) return;

    try {
      const transactionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
      const newTransaction = {
        type: formData.type,
        category: formData.category,
        date: formData.date,
        description: formData.description,
        amount: Number(formData.amount),
        receipt: formData.receipt || null,
        recorderName: formData.recorderName,
        timestamp: Date.now(),
        userId: user.uid
      };
      
      await addDoc(transactionsRef, newTransaction);
      
      // Trigger Webhook async
      sendWebhookNotification(newTransaction);

      // Reset
      setFormData({
        type: 'expense',
        category: EXPENSE_CATEGORIES[0],
        date: new Date().toISOString().split('T')[0],
        description: '',
        amount: '',
        receipt: null,
        recorderName: formData.recorderName // keep name for convenience
      });
      setShowForm(false);
    } catch (error) {
      console.error("Error adding document: ", error);
    }
  };

  const handleDelete = async (id) => {
    if (!user || !isAdmin) return;
    if(window.confirm("คุณแน่ใจหรือไม่ที่จะลบรายการนี้?")) {
      try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', id)); } 
      catch (error) { console.error("Error deleting: ", error); }
    }
  };

  const saveWebhook = () => {
    localStorage.setItem('company_webhook', webhookUrl);
    setWebhookTestStatus('บันทึกการตั้งค่า Webhook สำเร็จ!');
    setTimeout(() => setWebhookTestStatus(''), 3000);
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPinInput === '1234') { // Default PIN
      setIsAdmin(true);
      setAdminPinInput('');
    } else {
      alert("รหัส PIN ไม่ถูกต้อง");
    }
  };

  const exportToCSV = () => {
    const dataToExport = activeTab === 'transactions' ? monthlyTransactions : transactions;
    if (dataToExport.length === 0) return;

    const headers = ["วันที่", "ประเภท", "หมวดหมู่", "รายการ", "ผู้บันทึก", "จำนวนเงิน (บาท)"];
    const rows = dataToExport.map(t => [
      t.date,
      t.type === 'income' ? 'รายรับ' : 'รายจ่าย',
      `"${t.category}"`,
      `"${t.description.replace(/"/g, '""')}"`,
      `"${(t.recorderName || '-').replace(/"/g, '""')}"`,
      t.amount
    ]);

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `บัญชี_${activeTab === 'transactions' ? currentMonthString : 'ทั้งหมด'}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // --- Formatting ---
  const formatMoney = (amount) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);
  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
  const expenseRatio = totals.income > 0 ? Math.min((totals.expense / totals.income) * 100, 100) : (totals.expense > 0 ? 100 : 0);

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950 text-slate-500">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
      <p className="ml-3 font-medium">กำลังโหลดข้อมูล...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 md:pb-0 font-sans transition-colors duration-300">
      
      {/* Top Nav */}
      <nav className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-2">
              <div className="bg-indigo-500 text-white p-2 rounded-xl"><DollarSign className="h-6 w-6" /></div>
              <span className="font-bold text-lg tracking-wide hidden sm:block">ProAccount</span>
            </div>
            
            {/* Desktop Menu */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="hidden md:flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                {[
                  { id: 'dashboard', icon: PieChart, label: 'แดชบอร์ด' },
                  { id: 'analytics', icon: BarChart3, label: 'สถิติ' },
                  { id: 'transactions', icon: List, label: 'รายการ' },
                  { id: 'settings', icon: Settings, label: 'ตั้งค่า' }
                ].map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}
                  >
                    <tab.icon className="h-4 w-4 mr-2" /> {tab.label}
                  </button>
                ))}
              </div>

              <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">
                {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Top Action Bar (Contextual) */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
          
          {/* Left Context: Date or Title depending on tab */}
          <div className="flex items-center mb-4 sm:mb-0 w-full sm:w-auto justify-center sm:justify-start">
            {activeTab === 'dashboard' || activeTab === 'transactions' ? (
              <>
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"><ChevronLeft className="h-5 w-5" /></button>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 min-w-[140px] text-center flex items-center justify-center">
                  <Calendar className="h-4 w-4 mr-2 text-indigo-500" /> {monthName}
                </h2>
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"><ChevronRight className="h-5 w-5" /></button>
              </>
            ) : activeTab === 'analytics' ? (
              <>
                <button onClick={() => setSelectedYear(selectedYear - 1)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"><ChevronLeft className="h-5 w-5" /></button>
                <h2 className="text-lg font-bold min-w-[140px] text-center">ปี {selectedYear + 543}</h2>
                <button onClick={() => setSelectedYear(selectedYear + 1)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"><ChevronRight className="h-5 w-5" /></button>
              </>
            ) : (
              <h2 className="text-lg font-bold px-4"><Settings className="h-5 w-5 inline mr-2 text-indigo-500"/> การตั้งค่าระบบ</h2>
            )}
          </div>
          
          {/* Right Actions */}
          <div className="flex space-x-3 w-full sm:w-auto">
            {(activeTab === 'dashboard' || activeTab === 'transactions') && (
              <button onClick={() => setShowForm(true)} className="flex-1 sm:flex-none flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm shadow-indigo-200 dark:shadow-none">
                <PlusCircle className="h-5 w-5 sm:mr-2" /> <span className="hidden sm:inline">เพิ่มรายการ</span>
              </button>
            )}
            {(activeTab === 'dashboard' || activeTab === 'transactions') && (
              <button onClick={exportToCSV} className="flex-1 sm:flex-none flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 px-5 py-2.5 rounded-xl font-medium transition-colors border border-slate-200 dark:border-slate-700">
                <Download className="h-5 w-5 sm:mr-2" /> <span className="hidden sm:inline">ส่งออก</span>
              </button>
            )}
          </div>
        </div>

        {/* --- TAB: DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20"><TrendingUp className="h-20 w-20 text-emerald-500" /></div>
                <div className="text-slate-500 dark:text-slate-400 mb-4 font-medium text-sm">รายรับรวม (เดือนนี้)</div>
                <span className="text-3xl font-bold text-slate-800 dark:text-white">{formatMoney(totals.income)}</span>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20"><TrendingDown className="h-20 w-20 text-rose-500" /></div>
                <div className="text-slate-500 dark:text-slate-400 mb-4 font-medium text-sm">รายจ่ายรวม (เดือนนี้)</div>
                <span className="text-3xl font-bold text-slate-800 dark:text-white">{formatMoney(totals.expense)}</span>
              </div>
              <div className={`rounded-3xl p-6 border shadow-sm relative ${totals.profit >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50' : 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/50'}`}>
                <div className="text-slate-500 dark:text-slate-400 mb-4 font-medium text-sm">กำไรสุทธิ</div>
                <span className={`text-4xl font-black tracking-tight ${totals.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {formatMoney(totals.profit)}
                </span>
                <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
                  <div className="flex justify-between text-xs mb-1 text-slate-500 dark:text-slate-400">
                    <span>สัดส่วนรายจ่ายเทียบรายรับ</span><span>{expenseRatio.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-1.5 rounded-full transition-all duration-1000 ${expenseRatio > 80 ? 'bg-rose-500' : expenseRatio > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${expenseRatio}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent & Categories Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">รายการล่าสุด</h3>
                  <button onClick={() => setActiveTab('transactions')} className="text-sm text-indigo-500 font-medium">ดูทั้งหมด</button>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {monthlyTransactions.slice(0, 4).map(t => (
                    <div key={t.id} className="p-5 flex justify-between items-center">
                      <div className="flex items-center space-x-4">
                        <div className={`p-3 rounded-2xl ${t.type === 'income' ? 'bg-emerald-100/50 text-emerald-600 dark:bg-emerald-500/10' : 'bg-rose-100/50 text-rose-500 dark:bg-rose-500/10'}`}>
                          {t.type === 'income' ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-200">{t.description}</p>
                          <p className="text-xs text-slate-400 mt-1">{t.category} • {formatDate(t.date)}</p>
                        </div>
                      </div>
                      <span className={`font-semibold ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-800 dark:text-slate-200'}`}>
                        {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount)}
                      </span>
                    </div>
                  ))}
                  {monthlyTransactions.length === 0 && <div className="p-10 text-center text-slate-400">ยังไม่มีรายการในเดือนนี้</div>}
                </div>
              </div>

              {/* Category Breakdown (Simple List) */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6">
                 <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">สัดส่วนรายจ่าย (หมวดหมู่)</h3>
                 <div className="space-y-4">
                   {EXPENSE_CATEGORIES.map(cat => {
                     const catSum = monthlyTransactions.filter(t => t.type === 'expense' && t.category === cat).reduce((sum, t) => sum + t.amount, 0);
                     if (catSum === 0) return null;
                     const percent = totals.expense > 0 ? (catSum / totals.expense) * 100 : 0;
                     return (
                       <div key={cat}>
                         <div className="flex justify-between text-sm mb-1">
                           <span className="text-slate-600 dark:text-slate-300">{cat}</span>
                           <span className="font-medium text-slate-800 dark:text-slate-200">{formatMoney(catSum)}</span>
                         </div>
                         <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                           <div className="bg-indigo-500 h-2 rounded-full" style={{width: `${percent}%`}}></div>
                         </div>
                       </div>
                     )
                   })}
                   {totals.expense === 0 && <p className="text-sm text-slate-400 text-center py-4">ยังไม่มีรายจ่าย</p>}
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB: ANALYTICS (YEARLY) --- */}
        {activeTab === 'analytics' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 animate-in fade-in">
            <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-100 mb-6">สรุปผลประกอบการ ปี {selectedYear + 543}</h3>
            
            <div className="h-80 flex items-end justify-between space-x-2 pt-10 pb-4 border-b border-slate-100 dark:border-slate-800 relative">
              {/* Chart Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 dark:opacity-10 text-xs text-slate-400">
                 <div className="border-b border-slate-300 w-full h-0"></div>
                 <div className="border-b border-slate-300 w-full h-0"></div>
                 <div className="border-b border-slate-300 w-full h-0"></div>
                 <div className="border-b border-slate-300 w-full h-0"></div>
              </div>
              
              {/* Bars */}
              {yearlyData.data.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end items-center group relative h-full z-10">
                  
                  {/* Tooltip */}
                  <div className="absolute -top-12 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                    รับ: {Number(m.income).toLocaleString()} <br/> จ่าย: {Number(m.expense).toLocaleString()}
                  </div>

                  <div className="flex w-full justify-center space-x-0.5 sm:space-x-1 h-full items-end">
                    <div 
                      className="w-1/3 sm:w-1/2 bg-emerald-400 dark:bg-emerald-500 rounded-t-sm transition-all duration-700" 
                      style={{height: `${(m.income / yearlyData.maxAmount) * 100}%`, minHeight: m.income > 0 ? '4px' : '0'}}
                    ></div>
                    <div 
                      className="w-1/3 sm:w-1/2 bg-rose-400 dark:bg-rose-500 rounded-t-sm transition-all duration-700" 
                      style={{height: `${(m.expense / yearlyData.maxAmount) * 100}%`, minHeight: m.expense > 0 ? '4px' : '0'}}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
            {/* X-Axis Labels */}
            <div className="flex justify-between mt-2 text-[10px] sm:text-xs text-slate-500">
              {yearlyData.data.map((m, i) => <div key={i} className="flex-1 text-center">{m.month}</div>)}
            </div>

            <div className="flex justify-center mt-6 space-x-6 text-sm">
              <div className="flex items-center"><div className="w-3 h-3 bg-emerald-400 rounded-full mr-2"></div> รายรับ</div>
              <div className="flex items-center"><div className="w-3 h-3 bg-rose-400 rounded-full mr-2"></div> รายจ่าย</div>
            </div>
          </div>
        )}

        {/* --- TAB: TRANSACTIONS (LIST & SEARCH) --- */}
        {activeTab === 'transactions' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in">
             
             {/* Search & Filter Bar */}
             <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="ค้นหาชื่อรายการ หรือ ชื่อผู้บันทึก..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                  />
                </div>
                <div className="relative w-full sm:w-48">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <select 
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none dark:text-white"
                  >
                    <option value="all">ทุกหมวดหมู่</option>
                    <optgroup label="รายรับ">{INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                    <optgroup label="รายจ่าย">{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                  </select>
                </div>
             </div>
             
             {/* Transaction Table */}
             <div className="hidden md:block overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="text-slate-400 dark:text-slate-500 text-xs uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/30">
                     <th className="px-6 py-4 font-medium border-b border-slate-100 dark:border-slate-800">วันที่ / หมวดหมู่</th>
                     <th className="px-6 py-4 font-medium border-b border-slate-100 dark:border-slate-800">รายละเอียด</th>
                     <th className="px-6 py-4 font-medium border-b border-slate-100 dark:border-slate-800">ผู้บันทึก</th>
                     <th className="px-6 py-4 font-medium border-b border-slate-100 dark:border-slate-800 text-center">หลักฐาน</th>
                     <th className="px-6 py-4 font-medium border-b border-slate-100 dark:border-slate-800 text-right">จำนวนเงิน</th>
                     <th className="px-6 py-4 font-medium border-b border-slate-100 dark:border-slate-800 text-center">จัดการ</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                   {monthlyTransactions.map(t => (
                     <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                       <td className="px-6 py-4">
                         <div className="text-sm text-slate-500 dark:text-slate-400">{formatDate(t.date)}</div>
                         <div className={`mt-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${t.type === 'income' ? 'bg-emerald-100/50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-100/50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'}`}>
                           {t.category}
                         </div>
                       </td>
                       <td className="px-6 py-4 text-sm font-medium text-slate-800 dark:text-slate-200">{t.description}</td>
                       <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{t.recorderName || '-'}</td>
                       <td className="px-6 py-4 text-center">
                         {t.receipt ? (
                           <button onClick={() => setViewingReceipt(t.receipt)} className="text-slate-400 hover:text-indigo-500 p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700" title="ดูใบเสร็จ"><ImageIcon className="h-4 w-4" /></button>
                         ) : <span className="text-slate-300 dark:text-slate-600 text-xs">-</span>}
                       </td>
                       <td className={`px-6 py-4 text-sm text-right font-semibold ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
                         {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount)}
                       </td>
                       <td className="px-6 py-4 text-center">
                         {isAdmin ? (
                           <button onClick={() => handleDelete(t.id)} className="text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-4 w-4 mx-auto" /></button>
                         ) : (
                           <Lock className="h-4 w-4 mx-auto text-slate-200 dark:text-slate-700" title="เฉพาะ Admin ถึงลบได้" />
                         )}
                       </td>
                     </tr>
                   ))}
                   {monthlyTransactions.length === 0 && <tr><td colSpan="6" className="px-6 py-16 text-center text-slate-400">ไม่พบข้อมูล</td></tr>}
                 </tbody>
               </table>
             </div>

             {/* Mobile View */}
             <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {monthlyTransactions.map(t => (
                  <div key={t.id} className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 pr-2">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${t.type === 'income' ? 'bg-emerald-100/50 text-emerald-700' : 'bg-rose-100/50 text-rose-700'}`}>{t.category}</span>
                          <span className="text-xs text-slate-400">{formatDate(t.date)}</span>
                        </div>
                        <h4 className="font-medium text-slate-800 dark:text-slate-200 text-sm">{t.description}</h4>
                        <p className="text-[11px] text-slate-500 mt-1">ผู้บันทึก: {t.recorderName}</p>
                      </div>
                      <div className="text-right">
                        <span className={`block font-semibold ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
                          {t.type === 'income' ? '+' : '-'}{Number(t.amount).toLocaleString()}
                        </span>
                        {t.receipt && <button onClick={() => setViewingReceipt(t.receipt)} className="mt-2 inline-flex items-center text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 px-2 py-1 rounded-md"><ImageIcon className="h-3 w-3 mr-1"/> ใบเสร็จ</button>}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex justify-end pt-2 border-t border-slate-50 dark:border-slate-800/50 mt-2">
                        <button onClick={() => handleDelete(t.id)} className="flex items-center text-xs text-rose-500 p-1"><Trash2 className="h-3 w-3 mr-1" /> ลบ</button>
                      </div>
                    )}
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* --- TAB: SETTINGS --- */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in">
            
            {/* Admin Controls */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6">
              <div className="flex items-center mb-4">
                <Shield className="h-6 w-6 text-indigo-500 mr-2" />
                <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-100">ระบบสิทธิ์การใช้งาน (Admin)</h3>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">เมื่อเปิดโหมดแอดมิน คุณจะสามารถ "ลบรายการ" ที่บันทึกผิดพลาดได้</p>
              
              {isAdmin ? (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 p-4 rounded-xl flex justify-between items-center">
                  <div className="flex items-center text-emerald-700 dark:text-emerald-400">
                    <Unlock className="h-5 w-5 mr-2" /> <span className="font-medium">คุณอยู่ในโหมด Admin แล้ว</span>
                  </div>
                  <button onClick={() => setIsAdmin(false)} className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50">ออกจากระบบ Admin</button>
                </div>
              ) : (
                <form onSubmit={handleAdminLogin} className="flex space-x-3">
                  <input 
                    type="password" placeholder="ใส่ PIN (ค่าเริ่มต้น: 1234)" 
                    value={adminPinInput} onChange={(e)=>setAdminPinInput(e.target.value)}
                    className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                  <button type="submit" className="px-5 py-2 bg-slate-800 dark:bg-indigo-600 text-white rounded-xl font-medium">เข้าสู่ระบบ</button>
                </form>
              )}
            </div>

            {/* Webhook / LINE Notify Settings */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6">
              <div className="flex items-center mb-4">
                <Bell className="h-6 w-6 text-indigo-500 mr-2" />
                <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-100">การแจ้งเตือน (Webhook / LINE Notify)</h3>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                ระบบจะยิงข้อมูลไปที่ Webhook URL ที่ระบุเมื่อมีการเพิ่มรายการใหม่ (แนะนำให้ใช้ร่วมกับ Make.com หรือ Zapier เพื่อส่งต่อเข้า LINE กลุ่ม)
              </p>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                <input 
                  type="url" placeholder="https://hook.make.com/..." 
                  value={webhookUrl} onChange={(e)=>setWebhookUrl(e.target.value)}
                  className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                />
                <button onClick={saveWebhook} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium flex items-center justify-center">
                  <Send className="h-4 w-4 mr-2" /> บันทึก
                </button>
              </div>
              {webhookTestStatus && <p className="mt-3 text-sm text-emerald-600">{webhookTestStatus}</p>}
            </div>

          </div>
        )}

      </main>

      {/* Mobile Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 flex justify-between px-2 py-2 z-20 pb-safe">
        {[
          { id: 'dashboard', icon: PieChart, label: 'แดชบอร์ด' },
          { id: 'analytics', icon: BarChart3, label: 'สถิติ' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center flex-1 p-2 ${activeTab === tab.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
            <tab.icon className="h-5 w-5" /><span className="text-[10px] mt-1 font-medium">{tab.label}</span>
          </button>
        ))}
        
        {/* FAB Add Button */}
        <button onClick={() => setShowForm(true)} className="flex flex-col items-center px-4 -mt-6">
          <div className="bg-indigo-600 text-white p-3.5 rounded-2xl shadow-lg border-4 border-slate-50 dark:border-slate-950 active:scale-95 transition-transform"><PlusCircle className="h-6 w-6" /></div>
        </button>
        
        {[
          { id: 'transactions', icon: List, label: 'รายการ' },
          { id: 'settings', icon: Settings, label: 'ตั้งค่า' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center flex-1 p-2 ${activeTab === tab.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
            <tab.icon className="h-5 w-5" /><span className="text-[10px] mt-1 font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* --- ADD TRANSACTION MODAL --- */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden transform animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-100 dark:border-slate-800 max-h-[90vh] flex flex-col">
            <div className="p-6 pb-4 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">เพิ่มรายการใหม่</h2>
              <button onClick={() => setShowForm(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            
            <div className="p-6 pt-0 overflow-y-auto flex-1">
              <form onSubmit={handleAddTransaction} className="space-y-5">
                
                {/* Type Toggle */}
                <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                  <button type="button" onClick={() => handleTypeChange('income')} className={`flex-1 py-2.5 text-sm font-semibold rounded-lg ${formData.type === 'income' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500'}`}>รายรับ</button>
                  <button type="button" onClick={() => handleTypeChange('expense')} className={`flex-1 py-2.5 text-sm font-semibold rounded-lg ${formData.type === 'expense' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-500'}`}>รายจ่าย</button>
                </div>

                {/* Category Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">หมวดหมู่</label>
                  <select 
                    value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  >
                    {(formData.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">วันที่</label>
                  <input type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white dark:[color-scheme:dark]"/>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">รายละเอียดรายการ</label>
                  <input type="text" required placeholder="เช่น บิลค่าไฟเดือนนี้..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"/>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">ผู้บันทึก</label>
                  <input type="text" required placeholder="ชื่อพนักงาน" value={formData.recorderName} onChange={(e) => setFormData({...formData, recorderName: e.target.value})} className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"/>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">จำนวนเงิน</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">฿</span>
                    <input type="number" required min="0" step="0.01" placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="w-full pl-9 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-lg font-medium dark:text-white"/>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">แนบใบเสร็จ (ตัวเลือก)</label>
                  {formData.receipt ? (
                    <div className="relative inline-block border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                      <img src={formData.receipt} alt="Preview" className="h-24 w-auto object-cover" />
                      <button type="button" onClick={() => setFormData({...formData, receipt: null})} className="absolute top-1 right-1 bg-rose-500 text-white p-1 rounded-full"><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <label className={`flex items-center justify-center px-4 py-3 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${isCompressing ? 'opacity-50' : ''}`}>
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={isCompressing}/>
                      <Camera className="h-5 w-5 mr-2 text-slate-400" />
                      <span className="text-sm text-slate-500">{isCompressing ? 'กำลังประมวลผล...' : 'ถ่ายรูป / เลือกไฟล์'}</span>
                    </label>
                  )}
                </div>

                <div className="pt-4 pb-2">
                  <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-sm">
                    บันทึกข้อมูล
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer */}
      {viewingReceipt && (
        <div className="fixed inset-0 bg-slate-900/95 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-w-3xl w-full flex flex-col items-center">
            <button onClick={() => setViewingReceipt(null)} className="absolute -top-12 right-0 bg-white/10 text-white p-2 rounded-full"><X className="h-6 w-6" /></button>
            <img src={viewingReceipt} alt="Receipt" className="max-w-full max-h-[85vh] object-contain rounded-xl border border-slate-700/50 shadow-2xl" />
          </div>
        </div>
      )}

    </div>
  );
}