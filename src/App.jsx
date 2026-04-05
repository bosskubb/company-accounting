import React, { useState, useEffect, useMemo } from 'react';
import { 
  PieChart, List, PlusCircle, Download, Trash2, 
  TrendingUp, TrendingDown, DollarSign, ChevronLeft, ChevronRight, 
  Calendar, Sun, Moon, Camera, Image as ImageIcon, X,
  BarChart3, Search, Filter, Settings, Shield, Bell, Lock, Unlock, Send,
  ShoppingCart, FileText, Printer, Users, Plus
} from 'lucide-react';

// --- Firebase Setup ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDnhf_dIE1T0LlTMklxye6VdBWkI8M4YIo",
  authDomain: "mycompanyaccounting-60b76.firebaseapp.com",
  projectId: "mycompanyaccounting-60b76",
  storageBucket: "mycompanyaccounting-60b76.firebasestorage.app",
  messagingSenderId: "676343469584",
  appId: "1:676343469584:web:e808070dde8d928642dc95",
  measurementId: "G-C1Z850MCEZ"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'company-accounting-app'; 

// --- Constants ---
const INCOME_CATEGORIES = ['ขายสินค้า', 'บริการ', 'ดอกเบี้ย/ปันผล', 'เงินทุน', 'อื่นๆ'];
const EXPENSE_CATEGORIES = ['ค่าอุปกรณ์/สินค้า', 'เงินเดือน/ค่าจ้าง', 'ค่าเช่า/น้ำ/ไฟ', 'ค่าเดินทาง', 'การตลาด/โฆษณา', 'สวัสดิการ', 'ภาษี/ค่าธรรมเนียม', 'อื่นๆ'];

export default function App() {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [activeTab, setActiveTab] = useState('dashboard');
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
  
  // Forms State
  const [showForm, setShowForm] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState(null);

  // Transaction Form
  const [formData, setFormData] = useState({
    type: 'expense',
    category: EXPENSE_CATEGORIES[0],
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    receipt: null,
    recorderName: ''
  });

  // Order Form State
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [orderForm, setOrderForm] = useState({
    date: new Date().toISOString().split('T')[0],
    customerName: '',
    customerAddress: '',
    customerTaxId: '',
    poImage: null,
    items: [{ id: Date.now(), name: '', qty: 1, price: 0 }]
  });

  // 1. Authentication
  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } 
      catch (error) { console.error("Auth error:", error); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Data Fetching
  useEffect(() => {
    if (!user) return;
    
    const unsubscribeTx = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date) || b.timestamp - a.timestamp);
      setTransactions(data);
      setLoading(false);
    });

    const unsubscribeOrders = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => b.timestamp - a.timestamp);
      setOrders(data);
    });

    const unsubscribeCustomers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'customers'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomers(data);
    });

    return () => { unsubscribeTx(); unsubscribeOrders(); unsubscribeCustomers(); };
  }, [user]);

  // --- Helper Data ---
  const currentMonthString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const monthName = currentDate.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

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
    return { data, maxAmount: maxAmount > 0 ? maxAmount : 1000 };
  }, [transactions, selectedYear]);

  // --- Handlers ---
  const handleImageUpload = (e, targetState) => {
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
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        
        if(targetState === 'transaction') setFormData(prev => ({ ...prev, receipt: compressedBase64 }));
        else if (targetState === 'order') setOrderForm(prev => ({ ...prev, poImage: compressedBase64 }));
        setIsCompressing(false);
      };
    };
  };

  const sendWebhookNotification = async (message) => {
    if (!webhookUrl) return;
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message })
      });
    } catch (err) { console.log(err); }
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!user || !formData.description || !formData.amount || !formData.recorderName) return;
    try {
      const newTx = { ...formData, amount: Number(formData.amount), timestamp: Date.now(), userId: user.uid };
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), newTx);
      sendWebhookNotification(`🔔 รายการใหม่: ${newTx.description}\nประเภท: ${newTx.type === 'income' ? 'รายรับ' : 'รายจ่าย'}\nจำนวน: ${newTx.amount} บาท`);
      setFormData({ ...formData, description: '', amount: '', receipt: null });
      setShowForm(false);
    } catch (error) { console.error(error); }
  };

  const handleDeleteTransaction = async (id) => {
    if (!isAdmin) return alert("โหมด Admin เท่านั้น");
    if(window.confirm("แน่ใจหรือไม่ที่จะลบรายการนี้?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', id));
    }
  };

  const handleAddOrderItem = () => {
    setOrderForm(prev => ({ ...prev, items: [...prev.items, { id: Date.now(), name: '', qty: 1, price: 0 }] }));
  };
  const handleRemoveOrderItem = (id) => {
    if(orderForm.items.length === 1) return;
    setOrderForm(prev => ({ ...prev, items: prev.items.filter(item => item.id !== id) }));
  };
  const handleOrderItemChange = (id, field, value) => {
    setOrderForm(prev => ({
      ...prev, items: prev.items.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  const handleSaveOrder = async (e) => {
    e.preventDefault();
    if (!user || !orderForm.customerName) return alert("กรุณาใส่ชื่อลูกค้า");
    if (orderForm.items.some(i => !i.name || i.qty <= 0)) return alert("กรุณาระบุสินค้าและจำนวนให้ถูกต้อง");

    try {
      const totalAmount = orderForm.items.reduce((sum, item) => sum + (Number(item.qty) * Number(item.price)), 0);
      
      const existingCustomer = customers.find(c => c.name === orderForm.customerName);
      if(!existingCustomer) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'customers'), {
          name: orderForm.customerName, address: orderForm.customerAddress, taxId: orderForm.customerTaxId
        });
      }

      const newOrder = {
        date: orderForm.date,
        customer: { name: orderForm.customerName, address: orderForm.customerAddress, taxId: orderForm.customerTaxId },
        items: orderForm.items,
        total: totalAmount,
        poImage: orderForm.poImage,
        status: 'pending',
        timestamp: Date.now(),
        orderNumber: `PO${Date.now().toString().slice(-6)}`
      };

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), newOrder);
      sendWebhookNotification(`📦 ออเดอร์ใหม่ (PO): ${newOrder.orderNumber}\nลูกค้า: ${newOrder.customer.name}\nยอดรวม: ${totalAmount} บาท`);

      setOrderForm({
        date: new Date().toISOString().split('T')[0], customerName: '', customerAddress: '', customerTaxId: '',
        poImage: null, items: [{ id: Date.now(), name: '', qty: 1, price: 0 }]
      });
      setShowOrderForm(false);
    } catch (error) { console.error(error); }
  };

  const handleDeleteOrder = async (id) => {
    if (!isAdmin) return alert("โหมด Admin เท่านั้น");
    if(window.confirm("ลบคำสั่งซื้อนี้? ข้อมูลจะไม่สามารถกู้คืนได้")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', id));
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPinInput === '1234') { setIsAdmin(true); setAdminPinInput(''); } 
    else { alert("รหัส PIN ไม่ถูกต้อง"); }
  };

  const saveWebhook = () => {
    localStorage.setItem('company_webhook', webhookUrl);
    setWebhookTestStatus('บันทึกการตั้งค่า Webhook สำเร็จ!');
    setTimeout(() => setWebhookTestStatus(''), 3000);
  };

  const exportToCSV = (type) => {
    let data = [], headers = [], filename = '';
    if (type === 'transactions') {
      data = monthlyTransactions;
      if (data.length === 0) return;
      headers = ["วันที่", "ประเภท", "หมวดหมู่", "รายการ", "ผู้บันทึก", "จำนวนเงิน"];
      const rows = data.map(t => [t.date, t.type==='income'?'รายรับ':'รายจ่าย', `"${t.category}"`, `"${t.description}"`, `"${t.recorderName}"`, t.amount]);
      downloadCSV(headers, rows, `บัญชี_${currentMonthString}.csv`);
    } else {
      data = orders;
      if (data.length === 0) return;
      headers = ["วันที่", "เลขที่เอกสาร", "ชื่อลูกค้า", "รายการสินค้า", "ยอดรวม", "สถานะ"];
      const rows = data.map(o => [o.date, o.orderNumber, `"${o.customer.name}"`, `"${o.items.map(i => `${i.name}(x${i.qty})`).join(" + ")}"`, o.total, o.status==='pending'?'รอดำเนินการ':'เสร็จสิ้น']);
      downloadCSV(headers, rows, `ออเดอร์_ทั้งหมด.csv`);
    }
  };

  const downloadCSV = (headers, rows, filename) => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", filename);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  }

  // --- Formatting ---
  const formatMoney = (amount) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);
  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
  const expenseRatio = totals.income > 0 ? Math.min((totals.expense / totals.income) * 100, 100) : (totals.expense > 0 ? 100 : 0);

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950 text-slate-500">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div><p className="ml-3 font-medium">กำลังโหลดข้อมูล...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 md:pb-0 font-sans transition-colors duration-300 print:bg-white print:text-black">
      
      {/* Top Nav (Hidden in Print) */}
      <nav className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-2">
              <div className="bg-indigo-600 text-white p-2 rounded-xl"><DollarSign className="h-6 w-6" /></div>
              <span className="font-bold text-lg tracking-wide hidden sm:block">ProAccount ERP</span>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4 overflow-x-auto hide-scrollbar">
              <div className="hidden md:flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                {[
                  { id: 'dashboard', icon: PieChart, label: 'แดชบอร์ด' },
                  { id: 'orders', icon: ShoppingCart, label: 'ออเดอร์ (PO)' },
                  { id: 'analytics', icon: BarChart3, label: 'สถิติ' },
                  { id: 'transactions', icon: List, label: 'บัญชี' },
                  { id: 'settings', icon: Settings, label: 'ตั้งค่า' }
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'}`}>
                    <tab.icon className="h-4 w-4 mr-1.5" /> {tab.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Sun className="h-5 w-5 dark:hidden" /><Moon className="h-5 w-5 hidden dark:block" /></button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0 print:py-0">
        
        {/* Context Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 print:hidden">
          <div className="flex items-center mb-4 sm:mb-0 w-full sm:w-auto justify-center sm:justify-start">
            {activeTab === 'dashboard' || activeTab === 'transactions' ? (
              <><button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"><ChevronLeft className="h-5 w-5" /></button><h2 className="text-lg font-bold min-w-[140px] text-center"><Calendar className="h-4 w-4 mr-2 inline text-indigo-500" /> {monthName}</h2><button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"><ChevronRight className="h-5 w-5" /></button></>
            ) : activeTab === 'orders' ? (
              <h2 className="text-lg font-bold px-4"><ShoppingCart className="h-5 w-5 inline mr-2 text-indigo-500"/> ระบบจัดการคำสั่งซื้อ (PO)</h2>
            ) : activeTab === 'analytics' ? (
              <><button onClick={() => setSelectedYear(selectedYear - 1)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"><ChevronLeft className="h-5 w-5" /></button><h2 className="text-lg font-bold min-w-[140px] text-center">ปี {selectedYear + 543}</h2><button onClick={() => setSelectedYear(selectedYear + 1)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"><ChevronRight className="h-5 w-5" /></button></>
            ) : (
              <h2 className="text-lg font-bold px-4"><Settings className="h-5 w-5 inline mr-2 text-indigo-500"/> การตั้งค่าระบบ</h2>
            )}
          </div>
          
          <div className="flex space-x-3 w-full sm:w-auto">
            {(activeTab === 'dashboard' || activeTab === 'transactions') && (
              <>
                <button onClick={() => setShowForm(true)} className="flex-1 sm:flex-none flex items-center justify-center bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium"><PlusCircle className="h-5 w-5 sm:mr-2" /> <span className="hidden sm:inline">เพิ่มบัญชี</span></button>
                <button onClick={() => exportToCSV('transactions')} className="flex-1 sm:flex-none flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl font-medium"><Download className="h-5 w-5" /></button>
              </>
            )}
            {activeTab === 'orders' && (
              <>
                <button onClick={() => setShowOrderForm(true)} className="flex-1 sm:flex-none flex items-center justify-center bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium"><FileText className="h-5 w-5 sm:mr-2" /> <span className="hidden sm:inline">สร้างออเดอร์จาก PO</span></button>
                <button onClick={() => exportToCSV('orders')} className="flex-1 sm:flex-none flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl font-medium"><Download className="h-5 w-5" /></button>
              </>
            )}
          </div>
        </div>

        {/* --- TAB: ORDERS (PO) --- */}
        {activeTab === 'orders' && (
          <div className="space-y-6 animate-in fade-in print:hidden">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">รายการคำสั่งซื้อล่าสุด</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-slate-400 dark:text-slate-500 text-xs uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/30">
                      <th className="px-6 py-4 font-medium border-b border-slate-100 dark:border-slate-800">วันที่ / เลขที่</th>
                      <th className="px-6 py-4 font-medium border-b border-slate-100 dark:border-slate-800">ลูกค้า</th>
                      <th className="px-6 py-4 font-medium border-b border-slate-100 dark:border-slate-800 text-right">ยอดรวม</th>
                      <th className="px-6 py-4 font-medium border-b border-slate-100 dark:border-slate-800 text-center">สถานะ</th>
                      <th className="px-6 py-4 font-medium border-b border-slate-100 dark:border-slate-800 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {orders.map(order => (
                      <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{order.orderNumber}</div>
                          <div className="text-xs text-slate-500 mt-1">{formatDate(order.date)}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{order.customer.name}</div>
                          <div className="text-xs text-slate-400 mt-1">{order.items.length} รายการ</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-semibold text-slate-800 dark:text-slate-200">{formatMoney(order.total)}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${order.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700'}`}>
                            {order.status === 'pending' ? 'รอจัดซื้อ' : 'เสร็จสิ้น'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center flex justify-center space-x-2">
                          <button onClick={() => setViewingOrder(order)} className="text-xs bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-100">เปิดดู / พิมพ์</button>
                          {isAdmin && <button onClick={() => handleDeleteOrder(order.id)} className="text-slate-300 hover:text-rose-500 p-1.5"><Trash2 className="h-4 w-4" /></button>}
                        </td>
                      </tr>
                    ))}
                    {orders.length === 0 && <tr><td colSpan="5" className="px-6 py-16 text-center text-slate-400">ยังไม่มีรายการสั่งซื้อ</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB: DASHBOARD (Accounting) --- */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in print:hidden">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="text-slate-500 dark:text-slate-400 mb-4 font-medium text-sm">รายรับรวม (เดือนนี้)</div>
                <span className="text-3xl font-bold text-emerald-600">{formatMoney(totals.income)}</span>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="text-slate-500 dark:text-slate-400 mb-4 font-medium text-sm">รายจ่ายรวม (เดือนนี้)</div>
                <span className="text-3xl font-bold text-rose-600">{formatMoney(totals.expense)}</span>
              </div>
              <div className={`rounded-3xl p-6 border shadow-sm ${totals.profit >= 0 ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-rose-50 border-rose-100 dark:bg-rose-900/20 dark:border-rose-800'}`}>
                <div className="text-slate-500 dark:text-slate-400 mb-4 font-medium text-sm">กำไรสุทธิ</div>
                <span className={`text-4xl font-black ${totals.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatMoney(totals.profit)}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
               <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                 <h3 className="font-semibold">รายการล่าสุด (บัญชี)</h3>
                 <button onClick={() => setActiveTab('transactions')} className="text-sm text-indigo-500 font-medium">ดูทั้งหมด</button>
               </div>
               <div className="divide-y divide-slate-100 dark:divide-slate-800">
                 {monthlyTransactions.slice(0, 5).map(t => (
                   <div key={t.id} className="p-5 flex justify-between items-center">
                     <div>
                       <p className="font-medium text-sm text-slate-800 dark:text-slate-200">{t.description}</p>
                       <p className="text-xs text-slate-400 mt-1">{t.category} • {formatDate(t.date)}</p>
                     </div>
                     <span className={`font-semibold ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-800 dark:text-slate-200'}`}>
                       {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount)}
                     </span>
                   </div>
                 ))}
                 {monthlyTransactions.length === 0 && <div className="p-10 text-center text-slate-400">ยังไม่มีรายการในเดือนนี้</div>}
               </div>
            </div>
          </div>
        )}

        {/* --- TAB: ANALYTICS (Yearly) --- */}
        {activeTab === 'analytics' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 animate-in fade-in">
            <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-100 mb-6">สรุปผลประกอบการ ปี {selectedYear + 543}</h3>
            
            <div className="h-80 flex items-end justify-between space-x-2 pt-10 pb-4 border-b border-slate-100 dark:border-slate-800 relative">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 dark:opacity-10 text-xs text-slate-400">
                 <div className="border-b border-slate-300 w-full h-0"></div>
                 <div className="border-b border-slate-300 w-full h-0"></div>
                 <div className="border-b border-slate-300 w-full h-0"></div>
                 <div className="border-b border-slate-300 w-full h-0"></div>
              </div>
              
              {yearlyData.data.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end items-center group relative h-full z-10">
                  <div className="absolute -top-12 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                    รับ: {Number(m.income).toLocaleString()} <br/> จ่าย: {Number(m.expense).toLocaleString()}
                  </div>
                  <div className="flex w-full justify-center space-x-0.5 sm:space-x-1 h-full items-end">
                    <div className="w-1/3 sm:w-1/2 bg-emerald-400 dark:bg-emerald-500 rounded-t-sm transition-all duration-700" style={{height: `${(m.income / yearlyData.maxAmount) * 100}%`, minHeight: m.income > 0 ? '4px' : '0'}}></div>
                    <div className="w-1/3 sm:w-1/2 bg-rose-400 dark:bg-rose-500 rounded-t-sm transition-all duration-700" style={{height: `${(m.expense / yearlyData.maxAmount) * 100}%`, minHeight: m.expense > 0 ? '4px' : '0'}}></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[10px] sm:text-xs text-slate-500">
              {yearlyData.data.map((m, i) => <div key={i} className="flex-1 text-center">{m.month}</div>)}
            </div>
            <div className="flex justify-center mt-6 space-x-6 text-sm">
              <div className="flex items-center"><div className="w-3 h-3 bg-emerald-400 rounded-full mr-2"></div> รายรับ</div>
              <div className="flex items-center"><div className="w-3 h-3 bg-rose-400 rounded-full mr-2"></div> รายจ่าย</div>
            </div>
          </div>
        )}

        {/* --- TAB: TRANSACTIONS (List with Filter) --- */}
        {activeTab === 'transactions' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in print:hidden">
             
             {/* Search & Filter */}
             <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input 
                    type="text" placeholder="ค้นหาชื่อรายการ หรือ ผู้บันทึก..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                  />
                </div>
                <div className="relative w-full sm:w-48">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none dark:text-white">
                    <option value="all">ทุกหมวดหมู่</option>
                    <optgroup label="รายรับ">{INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                    <optgroup label="รายจ่าย">{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                  </select>
                </div>
             </div>

             <div className="hidden md:block overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="text-slate-400 text-xs uppercase bg-slate-50/50 dark:bg-slate-800/30">
                     <th className="px-6 py-4 font-medium border-b border-slate-100 dark:border-slate-800">วันที่</th>
                     <th className="px-6 py-4 font-medium border-b border-slate-100 dark:border-slate-800">รายละเอียด</th>
                     <th className="px-6 py-4 font-medium border-b border-slate-100 dark:border-slate-800 text-right">จำนวนเงิน</th>
                     <th className="px-6 py-4 font-medium border-b border-slate-100 dark:border-slate-800 text-center">หลักฐาน</th>
                     <th className="px-6 py-4 font-medium border-b border-slate-100 dark:border-slate-800 text-center">จัดการ</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                   {monthlyTransactions.map(t => (
                     <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                       <td className="px-6 py-4 text-sm text-slate-500">
                         {formatDate(t.date)}
                         <div className={`mt-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${t.type === 'income' ? 'bg-emerald-100/50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-100/50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'}`}>{t.category}</div>
                       </td>
                       <td className="px-6 py-4 text-sm font-medium">
                         {t.description}
                         <div className="text-[11px] text-slate-400 font-normal mt-1">{t.recorderName}</div>
                       </td>
                       <td className={`px-6 py-4 text-sm text-right font-semibold ${t.type === 'income' ? 'text-emerald-600' : ''}`}>{t.type === 'income' ? '+' : '-'}{formatMoney(t.amount)}</td>
                       <td className="px-6 py-4 text-center">{t.receipt && <button onClick={() => setViewingReceipt(t.receipt)} className="text-indigo-500"><ImageIcon className="h-4 w-4 mx-auto" /></button>}</td>
                       <td className="px-6 py-4 text-center">{isAdmin ? <button onClick={() => handleDeleteTransaction(t.id)} className="text-rose-500"><Trash2 className="h-4 w-4 mx-auto" /></button> : <Lock className="h-4 w-4 mx-auto text-slate-200 dark:text-slate-700" title="เฉพาะ Admin" />}</td>
                     </tr>
                   ))}
                   {monthlyTransactions.length === 0 && <tr><td colSpan="5" className="px-6 py-16 text-center text-slate-400">ไม่พบข้อมูล</td></tr>}
                 </tbody>
               </table>
             </div>
          </div>
        )}

        {/* --- TAB: SETTINGS --- */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6">
              <div className="flex items-center mb-4">
                <Shield className="h-6 w-6 text-indigo-500 mr-2" />
                <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-100">ระบบสิทธิ์การใช้งาน (Admin)</h3>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">เมื่อเปิดโหมดแอดมิน คุณจะสามารถ "ลบรายการ" ที่บันทึกผิดพลาดได้</p>
              
              {isAdmin ? (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 p-4 rounded-xl flex justify-between items-center">
                  <div className="flex items-center text-emerald-700 dark:text-emerald-400"><Unlock className="h-5 w-5 mr-2" /> <span className="font-medium">คุณอยู่ในโหมด Admin แล้ว</span></div>
                  <button onClick={() => setIsAdmin(false)} className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50">ออกจากระบบ Admin</button>
                </div>
              ) : (
                <form onSubmit={handleAdminLogin} className="flex space-x-3">
                  <input type="password" placeholder="ใส่ PIN (ค่าเริ่มต้น: 1234)" value={adminPinInput} onChange={(e)=>setAdminPinInput(e.target.value)} className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" />
                  <button type="submit" className="px-5 py-2 bg-slate-800 dark:bg-indigo-600 text-white rounded-xl font-medium">เข้าสู่ระบบ</button>
                </form>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6">
              <div className="flex items-center mb-4"><Bell className="h-6 w-6 text-indigo-500 mr-2" /><h3 className="font-semibold text-lg text-slate-800 dark:text-slate-100">การแจ้งเตือน (Webhook / LINE Notify)</h3></div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">ระบบจะยิงข้อมูลไปที่ Webhook URL ที่ระบุเมื่อมีการเพิ่มรายการ หรือ ออเดอร์ใหม่</p>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                <input type="url" placeholder="https://hook.make.com/..." value={webhookUrl} onChange={(e)=>setWebhookUrl(e.target.value)} className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" />
                <button onClick={saveWebhook} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium flex items-center justify-center"><Send className="h-4 w-4 mr-2" /> บันทึก</button>
              </div>
              {webhookTestStatus && <p className="mt-3 text-sm text-emerald-600">{webhookTestStatus}</p>}
            </div>
          </div>
        )}

      </main>

      {/* --- ORDER PRINT MODAL (Takes full screen when active) --- */}
      {viewingOrder && (
        <div className="fixed inset-0 bg-slate-100 dark:bg-slate-900 z-[100] overflow-y-auto animate-in fade-in print:bg-white print:p-0">
          
          {/* Action Bar (Hidden in Print) */}
          <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center print:hidden shadow-sm z-10">
            <h2 className="font-bold text-lg">เอกสารอ้างอิง: {viewingOrder.orderNumber}</h2>
            <div className="flex space-x-3">
              <button onClick={() => window.print()} className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium flex items-center"><Printer className="h-4 w-4 mr-2"/> พิมพ์เอกสาร</button>
              <button onClick={() => setViewingOrder(null)} className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg">ปิด</button>
            </div>
          </div>

          <div className="max-w-4xl mx-auto p-8 print:p-0 space-y-12">
            
            {/* DOCUMENT 1: PURCHASING LIST (ใบสั่งซื้อสำหรับจัดซื้อ) */}
            <div className="bg-white p-10 rounded-2xl shadow-sm print:shadow-none print:p-0 border border-slate-200 print:border-none">
              <div className="text-center mb-8 border-b-2 border-slate-800 pb-4">
                <h1 className="text-2xl font-black text-slate-800 uppercase tracking-widest">Purchasing List</h1>
                <p className="text-slate-500 font-medium">รายการจัดซื้อสินค้า</p>
              </div>
              
              <div className="flex justify-between mb-8 text-sm">
                <div>
                  <p className="text-slate-500">อ้างอิงลูกค้า:</p>
                  <p className="font-bold text-lg text-slate-800">{viewingOrder.customer.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800">เลขที่เอกสาร: <span className="text-indigo-600">{viewingOrder.orderNumber}</span></p>
                  <p className="text-slate-800">วันที่: {formatDate(viewingOrder.date)}</p>
                </div>
              </div>

              <table className="w-full text-left mb-8 border border-slate-200">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="p-3 font-bold text-slate-800 w-16 text-center">ลำดับ</th>
                    <th className="p-3 font-bold text-slate-800">รายการสินค้าที่ต้องจัดซื้อ</th>
                    <th className="p-3 font-bold text-slate-800 text-center w-32">จำนวน</th>
                    <th className="p-3 font-bold text-slate-800 text-center w-32">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {viewingOrder.items.map((item, index) => (
                    <tr key={index}>
                      <td className="p-3 text-center text-slate-500">{index + 1}</td>
                      <td className="p-3 font-medium">{item.name}</td>
                      <td className="p-3 text-center font-bold text-lg">{item.qty}</td>
                      <td className="p-3 text-center"><div className="w-6 h-6 rounded border-2 border-slate-300 mx-auto"></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-xs text-slate-400 text-center mt-10 print:mt-20">เอกสารสำหรับใช้ภายใน / จัดเตรียมสินค้า (Dropship)</div>
            </div>

            {/* Page Break for Print */}
            <div className="break-before-page"></div>

            {/* DOCUMENT 2: INVOICE / RECEIPT (ใบแจ้งหนี้/ใบเสร็จ) */}
            <div className="bg-white p-10 rounded-2xl shadow-sm print:shadow-none print:p-0 border border-slate-200 print:border-none">
              <div className="flex justify-between items-start mb-10 border-b-2 border-slate-800 pb-6">
                <div>
                  <h1 className="text-3xl font-black text-indigo-700">INVOICE / RECEIPT</h1>
                  <p className="text-slate-500 font-medium">ใบแจ้งหนี้ / ใบเสร็จรับเงิน</p>
                </div>
                <div className="text-right text-slate-800">
                  <p className="font-bold text-lg">บริษัท โปรแอคเคาน์ จำกัด</p>
                  <p className="text-sm text-slate-500">123 ถ.สุขุมวิท กรุงเทพฯ 10110<br/>เลขประจำตัวผู้เสียภาษี: 0105555555555</p>
                </div>
              </div>
              
              <div className="flex justify-between mb-8 text-sm">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 w-1/2 text-slate-800">
                  <p className="text-xs text-slate-500 mb-1 font-bold">ลูกค้า / Customer:</p>
                  <p className="font-bold text-lg">{viewingOrder.customer.name}</p>
                  <p className="text-slate-600 mt-1">{viewingOrder.customer.address || '-'}</p>
                  <p className="text-slate-600 mt-1">Tax ID: {viewingOrder.customer.taxId || '-'}</p>
                </div>
                <div className="text-right w-1/3 flex flex-col justify-center text-slate-800">
                  <div className="flex justify-between border-b border-slate-200 py-1"><span className="text-slate-500">No.</span><span className="font-bold">{viewingOrder.orderNumber}</span></div>
                  <div className="flex justify-between border-b border-slate-200 py-1"><span className="text-slate-500">Date</span><span className="font-bold">{formatDate(viewingOrder.date)}</span></div>
                </div>
              </div>

              <table className="w-full text-left mb-8 border border-slate-200 text-slate-800">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    <th className="p-3 font-medium w-16 text-center">No.</th>
                    <th className="p-3 font-medium">Description</th>
                    <th className="p-3 font-medium text-center w-24">Qty</th>
                    <th className="p-3 font-medium text-right w-32">Unit Price</th>
                    <th className="p-3 font-medium text-right w-32">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {viewingOrder.items.map((item, index) => (
                    <tr key={index}>
                      <td className="p-3 text-center text-slate-500">{index + 1}</td>
                      <td className="p-3 font-medium">{item.name}</td>
                      <td className="p-3 text-center">{item.qty}</td>
                      <td className="p-3 text-right">{Number(item.price).toLocaleString()}</td>
                      <td className="p-3 text-right font-semibold">{Number(item.qty * item.price).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end text-slate-800">
                <div className="w-1/2 md:w-1/3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex justify-between mb-2"><span className="text-slate-500">ยอดรวม (Sub Total)</span><span>{formatMoney(viewingOrder.total)}</span></div>
                  <div className="flex justify-between mb-2"><span className="text-slate-500">ภาษี (Vat 7%)</span><span>{formatMoney(viewingOrder.total * 0.07)}</span></div>
                  <div className="flex justify-between border-t border-slate-300 pt-2 mt-2"><span className="font-bold text-lg text-indigo-700">ยอดสุทธิ (Total)</span><span className="font-black text-lg">{formatMoney(viewingOrder.total * 1.07)}</span></div>
                </div>
              </div>

              {/* Signature Area */}
              <div className="flex justify-between mt-20 pt-10 px-10 text-slate-800">
                <div className="text-center w-48">
                  <div className="border-b border-slate-400 mb-2 h-8"></div>
                  <p className="text-sm text-slate-500">ผู้รับเงิน / Collector</p>
                </div>
                <div className="text-center w-48">
                  <div className="border-b border-slate-400 mb-2 h-8"></div>
                  <p className="text-sm text-slate-500">ผู้รับสินค้า / Receiver</p>
                </div>
              </div>
            </div>

            {/* PO Reference Image (Hidden in Print) */}
            {viewingOrder.poImage && (
              <div className="bg-white p-6 rounded-2xl shadow-sm print:hidden">
                <h3 className="font-bold mb-4 text-slate-500">รูปภาพเอกสาร PO อ้างอิง</h3>
                <img src={viewingOrder.poImage} alt="PO" className="w-full max-w-lg border rounded-lg" />
              </div>
            )}

          </div>
        </div>
      )}

      {/* --- ADD ORDER MODAL --- */}
      {showOrderForm && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">สร้างออเดอร์จาก PO</h2>
                <p className="text-xs text-slate-500 mt-1">บันทึกเพื่อออกใบจัดซื้อ และ ใบเสร็จ/ใบแจ้งหนี้</p>
              </div>
              <button onClick={() => setShowOrderForm(false)} className="p-2 bg-slate-200 dark:bg-slate-700 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-950">
              <form onSubmit={handleSaveOrder} className="space-y-6">
                
                {/* Customer Section */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="font-bold mb-4 flex items-center"><Users className="w-5 h-5 mr-2 text-indigo-500"/> ข้อมูลลูกค้า</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">ชื่อบริษัท / ลูกค้า *</label>
                      <input type="text" required placeholder="พิมพ์เพื่อค้นหา หรือเพิ่มใหม่..." value={orderForm.customerName} onChange={(e) => setOrderForm({...orderForm, customerName: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" list="customer-list"/>
                      <datalist id="customer-list">{customers.map(c => <option key={c.id} value={c.name} />)}</datalist>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">เลขประจำตัวผู้เสียภาษี (Tax ID)</label>
                      <input type="text" placeholder="13 หลัก (ถ้ามี)" value={orderForm.customerTaxId} onChange={(e) => setOrderForm({...orderForm, customerTaxId: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"/>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 mb-1">ที่อยู่</label>
                      <input type="text" placeholder="ที่อยู่สำหรับออกใบแจ้งหนี้" value={orderForm.customerAddress} onChange={(e) => setOrderForm({...orderForm, customerAddress: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"/>
                    </div>
                  </div>
                </div>

                {/* Items Section */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="font-bold mb-4 flex items-center"><ShoppingCart className="w-5 h-5 mr-2 text-indigo-500"/> รายการสินค้าที่สั่งซื้อ</h3>
                  
                  {orderForm.items.map((item, index) => (
                    <div key={item.id} className="flex flex-wrap md:flex-nowrap gap-3 mb-3 items-end border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="w-full md:flex-1">
                        <label className="block text-xs text-slate-500 mb-1">{index === 0 && 'ชื่อสินค้า'}</label>
                        <input type="text" required placeholder="เช่น สินค้า A..." value={item.name} onChange={(e) => handleOrderItemChange(item.id, 'name', e.target.value)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-lg outline-none"/>
                      </div>
                      <div className="w-24">
                        <label className="block text-xs text-slate-500 mb-1">{index === 0 && 'จำนวน'}</label>
                        <input type="number" required min="1" value={item.qty} onChange={(e) => handleOrderItemChange(item.id, 'qty', e.target.value)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-lg outline-none text-center"/>
                      </div>
                      <div className="w-32">
                        <label className="block text-xs text-slate-500 mb-1">{index === 0 && 'ราคา/หน่วย'}</label>
                        <input type="number" required min="0" value={item.price} onChange={(e) => handleOrderItemChange(item.id, 'price', e.target.value)} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-lg outline-none text-right"/>
                      </div>
                      <button type="button" onClick={() => handleRemoveOrderItem(item.id)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg mb-0.5"><Trash2 className="w-5 h-5"/></button>
                    </div>
                  ))}
                  
                  <button type="button" onClick={handleAddOrderItem} className="text-sm text-indigo-600 font-medium flex items-center mt-2 px-2 py-1 hover:bg-indigo-50 rounded-lg"><Plus className="w-4 h-4 mr-1"/> เพิ่มรายการ</button>
                  
                  <div className="text-right mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 mr-4">ยอดรวมทั้งหมด:</span>
                    <span className="text-2xl font-black text-indigo-600">
                      {formatMoney(orderForm.items.reduce((sum, i) => sum + (Number(i.qty) * Number(i.price)), 0))}
                    </span>
                  </div>
                </div>

                {/* PO Image Upload */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">แนบรูปใบ PO อ้างอิง (ตัวเลือก)</label>
                  {orderForm.poImage ? (
                    <div className="relative inline-block border border-slate-200 rounded-xl overflow-hidden">
                      <img src={orderForm.poImage} alt="PO Preview" className="h-32 w-auto object-cover" />
                      <button type="button" onClick={() => setOrderForm({...orderForm, poImage: null})} className="absolute top-1 right-1 bg-rose-500 text-white p-1 rounded-full"><X className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <label className={`flex items-center justify-center px-4 py-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${isCompressing ? 'opacity-50' : ''}`}>
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'order')} className="hidden" disabled={isCompressing}/>
                      <FileText className="h-6 w-6 mr-3 text-slate-400" />
                      <span className="text-sm text-slate-500 font-medium">{isCompressing ? 'กำลังประมวลผล...' : 'คลิกเพื่ออัปโหลดไฟล์ / ถ่ายรูป PO'}</span>
                    </label>
                  )}
                  <p className="text-xs text-slate-400 mt-2">* รูปภาพถูกบีบอัดอัตโนมัติเพื่อประหยัดพื้นที่จัดเก็บ</p>
                </div>

                <div className="pt-2">
                  <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md text-lg">บันทึกออเดอร์ และ ออกใบเสร็จ</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD TRANSACTION MODAL (ORIGINAL) --- */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in print:hidden">
           <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl p-6">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">เพิ่มรายการบัญชี</h2>
                <button onClick={() => setShowForm(false)} className="bg-slate-100 p-2 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
             </div>
             <form onSubmit={handleAddTransaction} className="space-y-4">
                <div className="flex bg-slate-100 rounded-xl p-1">
                  <button type="button" onClick={() => setFormData({...formData, type: 'income'})} className={`flex-1 py-2 font-semibold rounded-lg ${formData.type === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>รายรับ</button>
                  <button type="button" onClick={() => setFormData({...formData, type: 'expense'})} className={`flex-1 py-2 font-semibold rounded-lg ${formData.type === 'expense' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}>รายจ่าย</button>
                </div>
                <input type="text" required placeholder="รายละเอียด..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border rounded-xl" />
                <input type="number" required placeholder="จำนวนเงิน" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border rounded-xl" />
                <input type="text" required placeholder="ผู้บันทึก" value={formData.recorderName} onChange={(e) => setFormData({...formData, recorderName: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border rounded-xl" />
                <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold">บันทึก</button>
             </form>
           </div>
        </div>
      )}

      {/* Image Viewer */}
      {viewingReceipt && (
        <div className="fixed inset-0 bg-slate-900/95 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in print:hidden">
          <div className="relative max-w-3xl w-full flex flex-col items-center">
            <button onClick={() => setViewingReceipt(null)} className="absolute -top-12 right-0 bg-white/10 text-white p-2 rounded-full"><X className="h-6 w-6" /></button>
            <img src={viewingReceipt} alt="Receipt" className="max-w-full max-h-[85vh] object-contain rounded-xl border border-slate-700/50 shadow-2xl" />
          </div>
        </div>
      )}

      {/* Mobile Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200 flex justify-between px-2 py-2 z-20 pb-safe print:hidden">
        {[
          { id: 'dashboard', icon: PieChart, label: 'แดชบอร์ด' },
          { id: 'orders', icon: ShoppingCart, label: 'ออเดอร์' },
          { id: 'transactions', icon: List, label: 'บัญชี' },
          { id: 'settings', icon: Settings, label: 'ตั้งค่า' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center flex-1 p-2 ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`}>
            <tab.icon className="h-5 w-5" /><span className="text-[10px] mt-1 font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

    </div>
  );
}