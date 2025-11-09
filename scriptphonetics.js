document.addEventListener('DOMContentLoaded', () => {

    // --- CẤU HÌNH SUPABASE ---
    const SUPABASE_URL = 'https://habakuagkfubyzpucfzh.supabase.co'; 
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhYmFrdWFna2Z1Ynl6cHVjZnpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2ODU3NDYsImV4cCI6MjA3ODI2MTc0Nn0.xD8WGjCdPrTZS4HT8ftCszNM4f-cKgbMNBgYtAUf9sg'; 
    const AUDIO_BUCKET_NAME = 'audio_comments'; 
    
    // [CẤU HÌNH ADMIN VÀ HOÀN THÀNH KÝ TỰ]
    const ADMIN_PASSWORD = 'admin'; 
    const COMPLETION_STORAGE_KEY = 'ipa_completion_status';
    
    const { createClient } = supabase;
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // ------------------------------------------

    const symbols = document.querySelectorAll('.ipa-symbol');
    const completionIcons = document.querySelectorAll('.completion-container'); // [THÊM MỚI]

    // Lấy các phần tử DOM
    const vimeoPlayerContainer = document.getElementById('vimeo-player-container');
    const iframeTarget = document.getElementById('iframe-target');
    const videoPlayBtn = document.getElementById('video-play-btn');
    const videoPauseBtn = document.getElementById('video-pause-btn');
    const videoPlaceholder = document.getElementById('video-placeholder');

    let mediaRecorder;
    let audioChunks = [];
    let currentSymbol = ''; 
    let recordedAudioBlob = null; 
    let currentVideoSrc = null;

    const commentSymbolDisplay = document.getElementById('comment-symbol-display');
    const commentsList = document.getElementById('comments-list');
    const recordButton = document.getElementById('record-button');
    const stopButton = document.getElementById('stop-button');
    const sendCommentButton = document.getElementById('send-comment-button');
    const recordingPreview = document.getElementById('recording-preview');
    const recordStatus = document.getElementById('record-status');
    const commentToggleHeader = document.getElementById('comment-toggle-header');
    const commentContentWrapper = document.getElementById('comment-content-wrapper');

    // [LOGIC VIDEO VÀ NÚT BẤM ỔN ĐỊNH - KHÔNG THANH ĐIỀU KHIỂN]
    
    // Hàm tạo iframe (Phát video)
    function createIframe(src) {
        if (!src) return;
        
        const videoUrl = new URL(src);
        videoUrl.searchParams.set('loop', '1');
        videoUrl.searchParams.set('autoplay', '1'); 
        videoUrl.searchParams.set('controls', '0'); 
        videoUrl.searchParams.set('title', '0');    
        videoUrl.searchParams.set('byline', '0');   

        iframeTarget.innerHTML = '';
        const iframe = document.createElement('iframe');
        iframe.src = videoUrl.href;
        iframe.title = "Video hướng dẫn";
        iframe.frameBorder = "0";
        iframe.allow = "autoplay; fullscreen; picture-in-picture; web-share";
        iframe.allowFullscreen = true;
        iframeTarget.appendChild(iframe);
    }
    
    // Hàm xóa iframe (Dừng video)
    function destroyIframe() {
        iframeTarget.innerHTML = '';
        iframeTarget.appendChild(videoPlaceholder);
    }

    // Gắn sự kiện cho các nút Play/Pause
    videoPlayBtn.addEventListener('click', () => {
        vimeoPlayerContainer.classList.remove('video-hidden'); 
        createIframe(currentVideoSrc); 
        videoPlayBtn.disabled = true;
        videoPauseBtn.disabled = false;
    });
    
    videoPauseBtn.addEventListener('click', () => {
        destroyIframe(); 
        vimeoPlayerContainer.classList.add('video-hidden'); 
        videoPlayBtn.disabled = false;
        videoPauseBtn.disabled = true;
    });

    // Vô hiệu hóa nút bấm ngay từ đầu và ẩn video
    videoPlayBtn.disabled = true;
    videoPauseBtn.disabled = true;
    vimeoPlayerContainer.classList.add('video-hidden');

    // [FIX LỖI KÝ TỰ] Hàm chuẩn hóa tên ký tự cho Supabase Storage
    function getSafeSymbolName(symbol) {
        let safeName = symbol.replace(/:/g, 'L');
        
        // Ký tự đặc biệt (đảm bảo logic này khớp với data-symbol trong HTML)
        safeName = safeName.replace(/ʃ/g, 'sh');
        safeName = safeName.replace(/ʒ/g, 'zh');
        safeName = safeName.replace(/θ/g, 'th');
        safeName = safeName.replace(/ð/g, 'dh');
        safeName = safeName.replace(/ŋ/g, 'ng');
        safeName = safeName.replace(/tʃ/g, 'ch');
        safeName = safeName.replace(/dʒ/g, 'j');
        safeName = safeName.replace(/ʌ/g, 'A');
        safeName = safeName.replace(/ə/g, 'schwa');
        
        // [QUAN TRỌNG] Xử lý ɪ và ʊ đúng
        safeName = safeName.replace(/ɪ/g, 'I'); // I ngắn -> I
        safeName = safeName.replace(/ʊ/g, 'U'); // U ngắn -> U
        
        safeName = safeName.replace(/ɜ/g, 'er');
        safeName = safeName.replace(/ɔ/g, 'aw');
        safeName = safeName.replace(/æ/g, 'aE');
        safeName = safeName.replace(/ɑ/g, 'aLong');
        safeName = safeName.replace(/ɒ/g, 'oShort');
        safeName = safeName.replace(/\//g, '');
        safeName = safeName.replace(/ /g, '_');
        return safeName;
    }


    symbols.forEach(symbol => {
        symbol.addEventListener('click', () => {
            
            destroyIframe();
            
            const videoSrc = symbol.dataset.videoSrc;
            currentVideoSrc = videoSrc; 

            if (videoSrc) {
                vimeoPlayerContainer.classList.remove('video-hidden');
                createIframe(videoSrc);
                
                videoPlayBtn.disabled = false; 
                videoPauseBtn.disabled = false; 
            } else {
                vimeoPlayerContainer.classList.add('video-hidden');
            }

            const guideText = symbol.dataset.guide;
            const guideTextElement = document.getElementById('guide-text'); 
            if (guideText) {
                guideTextElement.textContent = guideText;
            } else {
                guideTextElement.textContent = "Chưa có hướng dẫn cho ký tự này.";
            }

            symbols.forEach(s => s.classList.remove('active'));
            symbol.classList.add('active');
            
            // Lưu ký tự GỐC vào currentSymbol
            const originalSymbol = symbol.dataset.symbol; 
            currentSymbol = originalSymbol; 
            commentSymbolDisplay.textContent = originalSymbol;
            
            commentToggleHeader.classList.remove('collapsed');
            commentContentWrapper.classList.remove('collapsed');

            loadComments(currentSymbol);
            resetCommentForm();
        });
    });

    commentToggleHeader.addEventListener('click', () => {
        commentToggleHeader.classList.toggle('collapsed');
        commentContentWrapper.classList.toggle('collapsed');
    });

    // --- LOGIC HOÀN THÀNH KÝ TỰ (THÊM MỚI) ---

    // 1. Hàm tải trạng thái hoàn thành từ LocalStorage
    function loadCompletionStatus() {
        const status = JSON.parse(localStorage.getItem(COMPLETION_STORAGE_KEY)) || {};
        symbols.forEach(symbol => {
            const ipaKey = symbol.dataset.symbol;
            if (status[ipaKey]) {
                symbol.classList.add('completed');
                const icon = symbol.querySelector('.completion-status-icon');
                if (icon) icon.textContent = '✔';
            }
        });
    }

    // 2. Hàm lưu trạng thái và đổi màu
    function toggleCompletion(symbolElement) {
        const ipaKey = symbolElement.dataset.symbol;
        let status = JSON.parse(localStorage.getItem(COMPLETION_STORAGE_KEY)) || {};
        
        const isCompleted = symbolElement.classList.contains('completed');
        const icon = symbolElement.querySelector('.completion-status-icon');

        if (isCompleted) {
            // Yêu cầu mật khẩu Admin để HỦY HOÀN THÀNH
            const enteredPassword = prompt("Vui lòng nhập mật khẩu Admin để hủy đánh dấu hoàn thành:");
            if (enteredPassword === ADMIN_PASSWORD) {
                symbolElement.classList.remove('completed');
                delete status[ipaKey];
                if (icon) icon.textContent = '☐';
            } else if (enteredPassword !== null) {
                alert("Mật khẩu không đúng.");
            }
        } else {
            // Yêu cầu mật khẩu Admin để ĐÁNH DẤU HOÀN THÀNH
            const enteredPassword = prompt("Vui lòng nhập mật khẩu Admin để đánh dấu hoàn thành:");
            if (enteredPassword === ADMIN_PASSWORD) {
                symbolElement.classList.add('completed');
                status[ipaKey] = true;
                if (icon) icon.textContent = '✔';
            } else if (enteredPassword !== null) {
                alert("Mật khẩu không đúng.");
            }
        }

        localStorage.setItem(COMPLETION_STORAGE_KEY, JSON.stringify(status));
    }

    // 3. Gắn sự kiện cho các biểu tượng hoàn thành
    completionIcons.forEach(iconContainer => {
        iconContainer.addEventListener('click', (e) => {
            e.stopPropagation(); // Ngăn sự kiện click lan truyền lên thẻ .ipa-symbol
            const parentSymbol = iconContainer.closest('.ipa-symbol');
            if (parentSymbol) {
                toggleCompletion(parentSymbol);
            }
        });
    });

    // Tải trạng thái khi trang load
    loadCompletionStatus(); 

    // --- CÁC HÀM XỬ LÝ GHI ÂM/SUPABASE ---

    // 1. BẮT ĐẦU GHI ÂM (Giữ nguyên)
    recordButton.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = event => audioChunks.push(event.data);

            mediaRecorder.onstop = () => {
                recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' }); 
                const audioUrl = URL.createObjectURL(recordedAudioBlob);
                recordingPreview.src = audioUrl; 
                recordingPreview.style.display = 'block';

                recordButton.disabled = false;
                stopButton.disabled = true;
                sendCommentButton.disabled = false;
                recordStatus.textContent = "Sẵn sàng để gửi! Bạn có thể nghe thử ở trên.";
            };

            audioChunks = []; 
            recordedAudioBlob = null;
            mediaRecorder.start();

            recordButton.disabled = true;
            stopButton.disabled = true;
            sendCommentButton.disabled = true;
            recordingPreview.style.display = 'none';
            recordStatus.textContent = "🔴 Đang ghi âm... Bấm 'Dừng' khi xong.";

        } catch (err) {
            console.error("Lỗi khi lấy micro:", err);
            recordStatus.textContent = "Không thể truy cập micro. Vui lòng cho phép quyền truy cập.";
        }
    });

    // 2. DỪNG GHI ÂM (Giữ nguyên)
    stopButton.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
    });

    // 3. GỬI BÌNH LUẬN VÀ UPLOAD (Đã FIX lỗi NULL VALUE)
    sendCommentButton.addEventListener('click', async () => {
        if (!recordedAudioBlob) {
            alert("Bạn chưa ghi âm.");
            return;
        }

        // --- LOGIC KIỂM TRA KÍCH THƯỚC FILE (500 KB) ---
        const MAX_FILE_SIZE_BYTES = 500 * 1024; 
        
        if (recordedAudioBlob.size > MAX_FILE_SIZE_BYTES) {
            alert(`File ghi âm quá lớn (${(recordedAudioBlob.size / 1024).toFixed(1)} KB). Kích thước tối đa là 500 KB.`);
            recordStatus.textContent = "❌ File quá lớn. Vui lòng ghi âm ngắn hơn.";
            sendCommentButton.disabled = false;
            return;
        }
        // ----------------------------------------------------------

        sendCommentButton.disabled = true;
        recordStatus.textContent = "Đang tải lên Supabase, vui lòng chờ...";
        let audioURL = null;
        let audioPath = null;
        
        // currentSymbol đang giữ ký tự GỐC (ví dụ: 'ɪ')
        const safeSymbolName = getSafeSymbolName(currentSymbol); 

        try {
            // Bước A: Tải file lên Supabase Storage
            const uniqueFileName = `${Date.now()}.webm`;
            // TẠO ĐƯỜNG DẪN DÙNG TÊN ĐÃ CHUẨN HÓA LÀM THƯ MỤC
            audioPath = `${safeSymbolName}/${uniqueFileName}`; 
            
            const { error: uploadError } = await sb.storage
                .from(AUDIO_BUCKET_NAME)
                .upload(audioPath, recordedAudioBlob, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            // [FIX LỖI NULL VALUE] Xây dựng URL công khai thủ công
            const supabaseRef = SUPABASE_URL.split('://')[1].split('.')[0]; 
            audioURL = `https://${supabaseRef}.supabase.co/storage/v1/object/public/${AUDIO_BUCKET_NAME}/${audioPath}`;

            if (!audioURL || audioURL.includes('null')) {
                throw new Error("Lỗi: Không thể xây dựng URL hợp lệ.");
            }

            // Bước C: Lưu thông tin vào Supabase Database
            const { error: dbError } = await sb
                .from('comments')
                .insert([
                    { 
                        symbol: currentSymbol, // LƯU KÝ TỰ GỐC (Ví dụ: ɪ)
                        audio_url: audioURL, // URL thủ công
                        created_at: new Date().toISOString()
                    }
                ]);

            if (dbError) throw dbError;

            recordStatus.textContent = "Gửi thành công!";
            resetCommentForm();
            loadComments(currentSymbol); 

        } catch (err) {
            console.error("Lỗi khi gửi bình luận:", err.message);
            recordStatus.textContent = `Gửi thất bại: ${err.message}`;
            sendCommentButton.disabled = false; 
            
            // Xóa file đã upload nếu DB bị lỗi
            if (audioPath) {
                 sb.storage.from(AUDIO_BUCKET_NAME).remove([audioPath]);
            }
        }
    });

    // 4. HÀM TẢI BÌNH LUẬN TỪ SUPABASE (Giữ nguyên)
    async function loadComments(symbol) {
        commentsList.innerHTML = 'Đang tải bình luận...'; 
        try {
            const { data, error } = await sb
                .from('comments')
                .select('*')
                .eq('symbol', symbol) // Truy vấn bằng ký tự GỐC
                .order('created_at', { ascending: false }); 
            
            if (error) throw error;
            
            commentsList.innerHTML = ''; 
            
            if (data.length === 0) {
                commentsList.innerHTML = '<p>Bạn chưa tập phát âm kí tự này.</p>';
                return;
            }

            data.forEach(comment => {
                displayComment(comment);
            });

        } catch (err) {
            console.error("Lỗi khi tải bình luận:", err.message);
            commentsList.innerHTML = '<p>Không thể tải bình luận.</p>';
        }
    }

    // 5. HÀM HIỂN THỊ 1 BÌNH LUẬN (Giữ nguyên)
    function displayComment(data) {
        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment-item';

        if (data.text && data.text.trim() !== "") {
            const textEl = document.createElement('p');
            textEl.textContent = data.text;
            commentDiv.appendChild(textEl);
        }

        if (data.audio_url) {
            const audioEl = document.createElement('audio');
            audioEl.controls = true;
            audioEl.src = data.audio_url;
            commentDiv.appendChild(audioEl);
        }

        if (data.created_at) { 
            const timeEl = document.createElement('div');
            timeEl.className = 'comment-timestamp';
            timeEl.textContent = new Date(data.created_at).toLocaleString("vi-VN");
            commentDiv.appendChild(timeEl);
        }

        if (data.audio_url || (data.text && data.text.trim() !== "")) {
             commentsList.appendChild(commentDiv);
        }
    }

    // 6. HÀM RESET FORM (Giữ nguyên)
    function resetCommentForm() {
        recordingPreview.style.display = 'none';
        recordingPreview.src = '';
        recordStatus.textContent = '';
        
        audioChunks = [];
        recordedAudioBlob = null;
        
        recordButton.disabled = false;
        stopButton.disabled = true;
        sendCommentButton.disabled = true; 
    }
});