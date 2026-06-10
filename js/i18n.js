const DEFAULT_LANGUAGE = 'en';

const DICTIONARY = {
    en: {
        app: {
            title: '8x8x8 3D Chess',
            tagline: 'Local and online cubic chess with full 3D movement.',
            canvasLabel: '3D chess board',
            movePickerLabel: 'Move picker'
        },
        language: {
            label: 'Language',
            english: 'English',
            chinese: 'Chinese'
        },
        colors: {
            white: 'White',
            black: 'Black'
        },
        pieces: {
            K: 'King',
            Q: 'Queen',
            R: 'Rook',
            B: 'Bishop',
            N: 'Knight',
            P: 'Pawn',
            piece: 'Piece'
        },
        sides: {
            kingside: 'kingside',
            queenside: 'queenside'
        },
        turn: {
            gameOver: 'Game over',
            toMove: ({ color }, lang) => `${label(lang, `colors.${color}`)} to move`
        },
        captured: {
            byWhite: 'Captured by White',
            byBlack: 'Captured by Black',
            none: 'none'
        },
        picker: {
            movablePieces: 'Movable Pieces',
            availableMoves: 'Available Moves',
            initialSummary: 'White pieces with legal moves',
            selectPiece: 'Select a piece',
            noActiveSelection: 'No active selection',
            destinationsOnTurn: 'Destinations appear on your turn.',
            selectPieceDestinations: 'Select a movable piece to list destinations.',
            gameOver: 'Game over',
            connectOnline: 'Connect online to move',
            waitingForColor: ({ color }, lang) => `Waiting for ${label(lang, `colors.${color}`)}`,
            movableSummary: ({ color, count }, lang) => `${label(lang, `colors.${color}`)} has ${count} movable piece${count === 1 ? '' : 's'}`,
            noMovable: 'No movable pieces.',
            selectedSummary: ({ type, coord, count }, lang) => `${label(lang, `pieces.${type}`)} ${coord} -> ${count} destination${count === 1 ? '' : 's'}`,
            noDestinations: 'This piece has no legal destinations.',
            castleMove: ({ side }, lang) => `castle ${side === 'kingside' ? 'K' : 'Q'}`
        },
        controls: {
            title: 'Game Controls',
            gameMode: 'Game Mode',
            local: 'Local Pass and Play',
            online: 'Online Multiplayer',
            boundary: 'Boundary Condition',
            timer: 'Timer per Player',
            resetCamera: 'Reset Camera',
            newGame: 'New Game',
            offerDraw: 'Offer Draw',
            surrender: 'Surrender'
        },
        online: {
            localStatus: 'Local pass and play',
            selectedStatus: 'Online mode selected.',
            youAre: ({ color }, lang) => `You are ${label(lang, `colors.${color}`)}.`,
            disconnected: 'Disconnected',
            connectingRoom: 'Creating online room...',
            roomReadyConnection: 'Room ready. Share the link with Black.',
            roomReadyGame: 'Room ready. You are White. Waiting for Black to join.',
            reconnecting: 'Reconnecting signaling...',
            enterRoom: 'Enter a room ID or shared room link.',
            joiningRoom: 'Joining room...',
            joiningAsBlack: 'Joining online room as Black...',
            joiningShared: 'Joining shared room...',
            joiningSharedGame: 'Joining shared online room...',
            timeoutJoin: 'Could not reach that room. Check that White still has the room open.',
            timeoutAccept: 'Opponent opened the room but did not finish connecting.',
            connectedWhite: 'Connected as White',
            connectedBlack: 'Connected as Black',
            blackJoined: 'Black joined. White to move.',
            connectedBlackGame: 'Connected. You are Black.',
            opponentDisconnected: 'Opponent disconnected',
            opponentDisconnectedGame: 'Opponent disconnected. Create or join a new room to continue online.',
            moveSyncFailed: 'Move sync failed',
            moveSyncFailedGame: 'Move sync failed. Start a new online room.',
            opponentSurrendered: 'Opponent surrendered. You win.',
            drawOfferPrompt: 'Opponent offers a draw. Accept?',
            drawDeclined: 'Draw offer declined.',
            roomFull: 'Room already has two players',
            roomFullGame: 'That room already has two players.',
            peerUnavailable: 'Room not found. Ask White to create a new room link.',
            networkError: 'Network error. Check internet connection and try again.',
            browserIncompatible: 'This browser cannot use WebRTC online play.',
            sslUnavailable: 'Online play needs HTTPS. Use the GitHub Pages link.',
            serverError: 'Peer server error. Try creating a new room.',
            peerMissing: 'PeerJS did not load. Check your internet connection and reload the page.',
            connectionError: ({ detail }) => `Connection error: ${detail || 'unknown error'}`,
            createRoom: 'Create Room',
            joinRoom: 'Join Room',
            or: 'OR',
            roomInput: 'Room ID or shared link',
            roomId: 'Room ID',
            copy: 'Copy'
        },
        boundary: {
            names: {
                forbidden: 'Forbidden',
                reflection: 'Reflection',
                periodic: 'Periodic'
            },
            info: {
                forbidden: 'Forbidden: pieces cannot move outside the 8x8x8 cube.',
                reflection: 'Reflection: a move that reaches an edge bounces back into the cube.',
                periodic: 'Periodic: leaving one side wraps the move to the opposite side.'
            }
        },
        timer: {
            noTimer: 'No Timer',
            fiveMinutes: '5 Minutes',
            tenMinutes: '10 Minutes',
            fifteenMinutes: '15 Minutes',
            thirtyMinutes: '30 Minutes',
            oneHour: '1 Hour',
            twoHours: '2 Hours',
            threeHours: '3 Hours',
            twentyFourHours: '24 Hours'
        },
        history: {
            title: 'Move History',
            started: 'Game started.',
            castle: ({ color, side, from, to }, lang) =>
                `${label(lang, `colors.${color}`)} ${label(lang, 'pieces.K')} castles ${label(lang, `sides.${side}`)} ${from} -> ${to}`,
            move: ({ color, type, from, to, capturedType, promotionType }, lang) => {
                const capture = capturedType ? ` captures ${label(lang, `pieces.${capturedType}`)}` : '';
                const promotion = promotionType ? ` promotes to ${label(lang, `pieces.${promotionType}`)}` : '';
                return `${label(lang, `colors.${color}`)} ${label(lang, `pieces.${type}`)} ${from} -> ${to}${capture}${promotion}`;
            }
        },
        rules: {
            title: '3D Movement',
            text: "Rook: axes. Bishop: plane and body diagonals. Queen: all straight 3D lines. Knight: 2-1 jumps on any plane. King: one cell in any direction. Pawn: forward on X, Y, or Z, captures forward diagonals, and promotes only on the opponent's Y or Z home face inside the bottom three rows."
        },
        hints: {
            label: 'Move Hints'
        },
        promotion: {
            title: 'Promote Pawn To'
        },
        status: {
            start: 'Select a white piece to begin.',
            connectBeforeMove: 'Connect to an opponent before moving online.',
            waitingForMove: ({ color }, lang) => `Waiting for ${label(lang, `colors.${color}`)} to move.`,
            selectionCleared: 'Selection cleared.',
            choosePieceFirst: 'Choose one of your pieces first.',
            turnOnly: ({ color }, lang) => `It is ${label(lang, `colors.${color}`)}'s turn.`,
            pieceSelected: ({ color, type, coord, count }, lang) =>
                `${label(lang, `colors.${color}`)} ${label(lang, `pieces.${type}`)} selected at ${coord}. ${count} legal move${count === 1 ? '' : 's'}.`,
            targetSelected: ({ coord }) => `${coord} selected. Click the same yellow destination again to move.`,
            checkmateWin: ({ color }, lang) => `${label(lang, `colors.${color}`)} wins by checkmate.`,
            stalemate: 'Stalemate. Game drawn.',
            inCheck: ({ color }, lang) => `${label(lang, `colors.${color}`)} is in check.`,
            timeWin: ({ color }, lang) => `${label(lang, `colors.${color}`)} wins on time.`,
            newGame: 'New game started. Select a white piece.',
            roomLinkCopied: 'Room link copied.',
            resignationWin: ({ color }, lang) => `${label(lang, `colors.${color}`)} wins by resignation.`,
            drawOfferSent: 'Draw offer sent.',
            drawAgreed: 'Game drawn by agreement.',
            drawAccepted: 'Draw accepted.',
            hintsHidden: 'Move hints hidden.',
            hintsShown: 'Move hints shown.'
        },
        alerts: {
            modeLocked: 'Game mode cannot change after the game starts or after online connection.',
            boundaryLocked: 'Boundary cannot change after the game starts or after online connection.',
            timerLocked: 'Timer cannot change after the game starts or after online connection.',
            drawPrompt: 'Agree to a draw?'
        }
    },
    zh: {
        app: {
            title: '8x8x8 3D 西洋棋',
            tagline: '本地與線上立體西洋棋，支援完整 3D 移動。',
            canvasLabel: '3D 西洋棋棋盤',
            movePickerLabel: '走法選擇器'
        },
        language: {
            label: '語言',
            english: '英文',
            chinese: '中文'
        },
        colors: {
            white: '白方',
            black: '黑方'
        },
        pieces: {
            K: '國王',
            Q: '皇后',
            R: '城堡',
            B: '主教',
            N: '騎士',
            P: '士兵',
            piece: '棋子'
        },
        sides: {
            kingside: '王翼',
            queenside: '后翼'
        },
        turn: {
            gameOver: '遊戲結束',
            toMove: ({ color }, lang) => `${label(lang, `colors.${color}`)}行棋`
        },
        captured: {
            byWhite: '白方吃掉',
            byBlack: '黑方吃掉',
            none: '無'
        },
        picker: {
            movablePieces: '可動棋子',
            availableMoves: '可走位置',
            initialSummary: '白方有合法走法的棋子',
            selectPiece: '選擇棋子',
            noActiveSelection: '尚未選擇',
            destinationsOnTurn: '輪到你時會顯示目的地。',
            selectPieceDestinations: '選擇可動棋子以列出目的地。',
            gameOver: '遊戲結束',
            connectOnline: '連上線上對手後才能移動',
            waitingForColor: ({ color }, lang) => `等待${label(lang, `colors.${color}`)}`,
            movableSummary: ({ color, count }, lang) => `${label(lang, `colors.${color}`)}有 ${count} 個可動棋子`,
            noMovable: '沒有可動棋子。',
            selectedSummary: ({ type, coord, count }, lang) => `${label(lang, `pieces.${type}`)} ${coord} -> ${count} 個目的地`,
            noDestinations: '這個棋子沒有合法目的地。',
            castleMove: ({ side }) => `易位 ${side === 'kingside' ? 'K' : 'Q'}`
        },
        controls: {
            title: '遊戲控制',
            gameMode: '遊戲模式',
            local: '本地輪流遊玩',
            online: '線上多人',
            boundary: '邊界規則',
            timer: '每位玩家時間',
            resetCamera: '重設視角',
            newGame: '新遊戲',
            offerDraw: '提和',
            surrender: '投降'
        },
        online: {
            localStatus: '本地輪流遊玩',
            selectedStatus: '已選擇線上模式。',
            youAre: ({ color }, lang) => `你是${label(lang, `colors.${color}`)}。`,
            disconnected: '未連線',
            connectingRoom: '正在建立線上房間...',
            roomReadyConnection: '房間已準備好。把連結分享給黑方。',
            roomReadyGame: '房間已準備好。你是白方，等待黑方加入。',
            reconnecting: '正在重新連接訊號...',
            enterRoom: '請輸入房間 ID 或分享連結。',
            joiningRoom: '正在加入房間...',
            joiningAsBlack: '正在以黑方加入線上房間...',
            joiningShared: '正在加入分享房間...',
            joiningSharedGame: '正在加入分享的線上房間...',
            timeoutJoin: '無法連到該房間。請確認白方仍然開著房間。',
            timeoutAccept: '對手開啟了房間，但沒有完成連線。',
            connectedWhite: '已連線為白方',
            connectedBlack: '已連線為黑方',
            blackJoined: '黑方已加入。白方行棋。',
            connectedBlackGame: '已連線。你是黑方。',
            opponentDisconnected: '對手已斷線',
            opponentDisconnectedGame: '對手已斷線。請建立或加入新房間繼續線上遊玩。',
            moveSyncFailed: '走法同步失敗',
            moveSyncFailedGame: '走法同步失敗。請重新建立線上房間。',
            opponentSurrendered: '對手投降。你獲勝。',
            drawOfferPrompt: '對手提出和局。接受嗎？',
            drawDeclined: '和局被拒絕。',
            roomFull: '房間已有兩位玩家',
            roomFullGame: '這個房間已有兩位玩家。',
            peerUnavailable: '找不到房間。請白方建立新的房間連結。',
            networkError: '網路錯誤。請檢查連線後再試。',
            browserIncompatible: '這個瀏覽器無法使用 WebRTC 線上遊玩。',
            sslUnavailable: '線上遊玩需要 HTTPS。請使用 GitHub Pages 連結。',
            serverError: 'Peer 伺服器錯誤。請重新建立房間。',
            peerMissing: 'PeerJS 沒有載入。請檢查網路連線並重新整理頁面。',
            connectionError: ({ detail }) => `連線錯誤：${detail || '未知錯誤'}`,
            createRoom: '建立房間',
            joinRoom: '加入房間',
            or: '或',
            roomInput: '房間 ID 或分享連結',
            roomId: '房間 ID',
            copy: '複製'
        },
        boundary: {
            names: {
                forbidden: '禁止越界',
                reflection: '反射',
                periodic: '循環'
            },
            info: {
                forbidden: '禁止越界：棋子不能移出 8x8x8 立方體。',
                reflection: '反射：走到邊緣時會彈回立方體內。',
                periodic: '循環：離開一側時會從相反側進入。'
            }
        },
        timer: {
            noTimer: '無計時',
            fiveMinutes: '5 分鐘',
            tenMinutes: '10 分鐘',
            fifteenMinutes: '15 分鐘',
            thirtyMinutes: '30 分鐘',
            oneHour: '1 小時',
            twoHours: '2 小時',
            threeHours: '3 小時',
            twentyFourHours: '24 小時'
        },
        history: {
            title: '走法紀錄',
            started: '遊戲開始。',
            castle: ({ color, side, from, to }, lang) =>
                `${label(lang, `colors.${color}`)}${label(lang, 'pieces.K')}${label(lang, `sides.${side}`)}易位 ${from} -> ${to}`,
            move: ({ color, type, from, to, capturedType, promotionType }, lang) => {
                const capture = capturedType ? ` 吃掉${label(lang, `pieces.${capturedType}`)}` : '';
                const promotion = promotionType ? ` 升變為${label(lang, `pieces.${promotionType}`)}` : '';
                return `${label(lang, `colors.${color}`)}${label(lang, `pieces.${type}`)} ${from} -> ${to}${capture}${promotion}`;
            }
        },
        rules: {
            title: '3D 移動',
            text: '城堡：沿座標軸移動。主教：沿平面對角線與立體對角線移動。皇后：所有 3D 直線。騎士：任一平面 2-1 跳躍。國王：任一方向一格。士兵：沿 X、Y 或 Z 前進，沿前方對角吃子，只能在碰到對方 Y 或 Z 起始面且位於底部三列內時升變。'
        },
        hints: {
            label: '走法提示'
        },
        promotion: {
            title: '士兵升變為'
        },
        status: {
            start: '選擇白方棋子開始。',
            connectBeforeMove: '線上移動前請先連到對手。',
            waitingForMove: ({ color }, lang) => `等待${label(lang, `colors.${color}`)}行棋。`,
            selectionCleared: '已取消選擇。',
            choosePieceFirst: '請先選擇你的棋子。',
            turnOnly: ({ color }, lang) => `現在是${label(lang, `colors.${color}`)}回合。`,
            pieceSelected: ({ color, type, coord, count }, lang) =>
                `已選擇${label(lang, `colors.${color}`)}${label(lang, `pieces.${type}`)} ${coord}。${count} 個合法走法。`,
            targetSelected: ({ coord }) => `已選擇 ${coord}。再次點擊同一個黃色目的地即可移動。`,
            checkmateWin: ({ color }, lang) => `${label(lang, `colors.${color}`)}將死獲勝。`,
            stalemate: '逼和，遊戲和局。',
            inCheck: ({ color }, lang) => `${label(lang, `colors.${color}`)}被將軍。`,
            timeWin: ({ color }, lang) => `${label(lang, `colors.${color}`)}因時間獲勝。`,
            newGame: '新遊戲開始。請選擇白方棋子。',
            roomLinkCopied: '房間連結已複製。',
            resignationWin: ({ color }, lang) => `${label(lang, `colors.${color}`)}因對手投降獲勝。`,
            drawOfferSent: '已送出和局提議。',
            drawAgreed: '雙方同意和局。',
            drawAccepted: '和局已接受。',
            hintsHidden: '已隱藏走法提示。',
            hintsShown: '已顯示走法提示。'
        },
        alerts: {
            modeLocked: '遊戲開始或線上連線後不能更改遊戲模式。',
            boundaryLocked: '遊戲開始或線上連線後不能更改邊界規則。',
            timerLocked: '遊戲開始或線上連線後不能更改計時。',
            drawPrompt: '同意和局嗎？'
        }
    }
};

export const I18N = {
    current: DEFAULT_LANGUAGE,
    languages: Object.keys(DICTIONARY)
};

function read(lang, key) {
    return key.split('.').reduce((node, part) => node?.[part], DICTIONARY[lang]);
}

function label(lang, key) {
    const value = read(lang, key) ?? read(DEFAULT_LANGUAGE, key);
    return typeof value === 'function' ? value({}, lang) : value ?? key;
}

function formatString(text, params) {
    return text.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? '');
}

export function hasTranslation(key) {
    return read(I18N.current, key) !== undefined || read(DEFAULT_LANGUAGE, key) !== undefined;
}

export function t(key, params = {}) {
    const lang = I18N.current;
    const value = read(lang, key) ?? read(DEFAULT_LANGUAGE, key);

    if (typeof value === 'function') return value(params, lang);
    if (typeof value === 'string') return formatString(value, params);
    return key;
}

export function applyLanguage(root = document) {
    document.documentElement.lang = I18N.current === 'zh' ? 'zh-Hant' : 'en';
    document.title = t('app.title');

    root.querySelectorAll('[data-i18n]').forEach((element) => {
        element.textContent = t(element.dataset.i18n);
    });

    root.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
        element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder));
    });

    root.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
        element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
    });

    root.querySelectorAll('[data-i18n-title]').forEach((element) => {
        element.setAttribute('title', t(element.dataset.i18nTitle));
    });

    root.querySelectorAll('[data-lang-option]').forEach((button) => {
        const active = button.dataset.langOption === I18N.current;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });
}

export function setLanguage(language) {
    if (!I18N.languages.includes(language) || language === I18N.current) return;
    I18N.current = language;
    applyLanguage();
    window.dispatchEvent(new CustomEvent('languagechange', { detail: { language } }));
}

export function resetLanguage() {
    I18N.current = DEFAULT_LANGUAGE;
    applyLanguage();
}
