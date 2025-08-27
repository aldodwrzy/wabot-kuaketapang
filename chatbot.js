const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  // QR Code Handler
  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      qrcode.generate(qr, { small: true });
      console.log('🔃 Scan QR ini di WhatsApp:');
      await QRCode.toFile('qr.png', qr);
      console.log('📷 QR code disimpan sebagai qr.png');
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;

      console.log('❌ Koneksi terputus. Alasan:', reason);

      if (reason === DisconnectReason.loggedOut || reason === 401) {
        console.log('🔁 Sesi logout, mencoba ulang dari awal...');
        // Hapus auth_info dan restart
        fs.rmSync(path.join(__dirname, 'auth_info'), { recursive: true, force: true });
        startBot();
      } else {
        console.log('🔁 Koneksi terputus, mencoba reconnect...');
        startBot();
      }
    }

    if (connection === 'open') {
      console.log('✅ Bot WhatsApp terhubung!');
    }
  });

  // Simpan sesi jika berubah
  sock.ev.on('creds.update', saveCreds);

  // Jawab pesan otomatis
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;

    // Deteksi jenis pesan
    let pesan = null;
    if (msg.message.conversation) {
      pesan = msg.message.conversation;
    } else if (msg.message.extendedTextMessage?.text) {
      pesan = msg.message.extendedTextMessage.text;
    } else if (msg.message.imageMessage) {
      pesan = '[gambar]';
    } else if (msg.message.stickerMessage) {
      pesan = '[stiker]';
    } else if (msg.message.ephemeralMessage) {
      pesan = '[pesan sementara]';
    }

    console.log(`📩 Pesan dari ${sender}: ${pesan}`);

    // Kalau bukan teks, balas default biar service tidak error
    if (!pesan || pesan.startsWith('[')) {
      await sock.sendMessage(sender, { text: '🙏 Maaf, untuk saat ini bot hanya bisa membaca pesan teks. Silahkan ketik *Info* untuk layanan.' });
      return;
    }

    let balasan = '';

    // Respon otomatis
    if (pesan.toLowerCase() == 'info') {
      balasan = '*Cinta sejati jangan ditunda, Daftarkan Nikah anda di KUA💕*\n\nSilahkan pilih layanan yang ingin anda ketahui…\n- Informasi Seputar Pernikahan Ketik *Nikah*\n- Informasi Seputar Tanah wakaf Ketik *Wakaf*\n- Konsultasi KUA Ketik *Konsul*';
    } else if (pesan.toLowerCase() == 'nikah') {
      balasan = '*Bukan hanya cukup ijab dan qabul, tapi pastikan cinta kalian tercatat di KUA. Karena cinta sejati juga butuh legalitas.*\n\nPilih layanan yang ingin anda ketahui:\n- Alur pendaftaran Nikah Ketik *Alur*\n- Syarat Nikah Ketik *Syarat*\n- Rukun Nikah Ketik *Rukun*\n- Persyaratan Isbat Nikah Ketik *Isbat*\n- Surat Nikah yang hilang Ketik *Hilang*\n- Surat Nikah yang salah tulis Ketik *Rusak*\n- Bimbingan Perkawinan Ketik *Bimwin*';
    } else if (pesan.toLowerCase() == 'wakaf') {
      balasan = 'Informasi mengenai layanan ini belum tersedia, silahkan ketik *Info* untuk menampilkan layanan lainnya';
    } else if (pesan.toLowerCase() == 'konsul') {
      balasan = 'Informasi mengenai layanan ini belum tersedia, silahkan ketik *Info* untuk menampilkan layanan lainnya';
    } else if (pesan.toLowerCase() == 'alur') {
      balasan = '*Langkah – Langkah mendaftarkan Nikah di KUA*\n1. Pertama, Datang ke KUA dengan membawa dokumen dokumen: Ketik *Syarat* untuk mengetahui Syarat-syarat Nikah\n2. Pemeriksaan kelengkapan berkas oleh Petugas KUA\n3. Menerima undangan Bimbingan Perkawinan (*Bimwin*)\n4. Membayar Biaya Pernikahan:\n   - Di KUA pada jam kerja Rp.0,-\n   - Di luar KUA Rp. 600.000,-\n5. Pelaksanaan Akad Nikah\n\nNB: Data KTP, KK, Akte Kelahiran Catin *WAJIB* sinkron';
    } else if (pesan.toLowerCase() == 'syarat') {
      balasan = '*Syarat Pernikahan*\n- Surat Pengantar Model N1-N7 dari Kepala Desa\n- Fotocopy KTP Catin Laki-laki & Perempuan\n- Fotocopy KK Catin Laki-laki & Perempuan\n- Fotocopy Akte Kelahiran Catin Laki-laki & Perempuan\n- Surat Sehat dari Puskesmas\n- Pas foto 2x3 (4 Lbr), 4x6 (2 Lbr), File JPG background biru\n- Materai 10.000 (3 lembar)\n- Surat Rekomendasi (jika di luar kecamatan)\n- Akte Kematian + N6 (jika orang tua meninggal)\n- Akte cerai asli (jika pernah cerai)\n- Surat izin orang tua (di bawah umur 21 tahun)\n- Surat izin atasan (TNI/POLRI)\n- Surat Keterangan Wali Nikah';
    } else if (pesan.toLowerCase() == 'rukun') {
      balasan = '*Rukun Nikah*\n1. Calon Suami\n2. Calon Istri\n3. Wali Nikah\n4. 2 orang saksi\n5. Ijab Qabul';
    } else if (pesan.toLowerCase() == 'hilang') {
      balasan = '*Buku Nikah yang hilang*\n1. Lapor kehilangan ke kepolisian\n2. Siapkan berkas ke kepolisian\n3. Ajukan ke KUA dengan:\n   a. Surat Kehilangan dari kepolisian\n   b. Fotocopy KTP\n   c. Pas foto 2x3 (2 lbr)\n4. Tunggu buku nikah selesai dibuat';
    } else if (pesan.toLowerCase() == 'rusak') {
      balasan = '*Buku Nikah yang rusak*\n1. Datang ke KUA membawa:\n   a. Fotocopy KTP\n   b. Pas foto 2x3 (2 lbr)\n   c. Buku nikah yang rusak\n2. Tunggu buku nikah selesai dibuat';
    } else if (pesan.toLowerCase() == 'bimwin') {
      balasan = '*Bimbingan Perkawinan (BIMWIN)*\nDilaksanakan setiap Rabu di KUA Ketapang.\nTujuan: Agar Catin memahami esensi pernikahan.\nSetelah BIMWIN, Catin akan mendapatkan sertifikat.';
    } else {
      balasan = 'Terimakasih telah menghubungi SAPA KUA Ketapang, silahkan ketik *Info* untuk memilih layanan';
    }

    await sock.sendMessage(sender, { text: balasan });
  });
  }
    
    startBot();