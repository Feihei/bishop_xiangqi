document.addEventListener('DOMContentLoaded', () => {

    // 游戏状态
    const gameState = {
        board: [],
        currentPlayer: true, // true为白方，false为黑方
        selectedPiece: null,
        gameOver: false,
        possibleMoves: [],
        boardHistory: [], // 历史走棋记录
        histortIndex: -1,
        maxHistory: 1000, 
        repetitionCount: new Map(), 
        gameMode: 'pvc',
        aiThinking: false,
        aiDifficulty: 'medium',
        aiDepths: { easy: 2, medium: 3, hard: 4 },
    };

    // 棋子类型定义
    const PIECE_TYPES = {
        KING: 0,      // 帅/将
        ROOK: 1,      // 车
        KNIGHT: 2,    // 马
        CANNON: 3,    // 炮
        BISHOP: 4,    // 象/相
        ADVISOR: 5,     // 士
        PAWN: 6       // 兵/卒
    };

    // 棋子显示字符
    const pieceChars = {
        [PIECE_TYPES.KING]: { true: '帅', false: '将' },
        [PIECE_TYPES.ROOK]: { true: '車', false: '車' },
        [PIECE_TYPES.KNIGHT]: { true: '馬', false: '馬' },
        [PIECE_TYPES.CANNON]: { true: '炮', false: '炮' },
        [PIECE_TYPES.BISHOP]: { true: '相', false: '象' },
        [PIECE_TYPES.ADVISOR]: { true: '士', false: '士' },
        [PIECE_TYPES.PAWN]: { true: '兵', false: '卒' }
    };
    
    // 棋子基本价值
    const pieceValues = [
        100,    // KING
        9,      // ROOK
        4,      // KNIGHT
        4.5,    // CANNON
        4,      // BISHOP
        2,      // ADVISOR
        1       // PAWN
    ];

    // 棋子初始布局
    const initialSetup = [
        // 黑方
        [[PIECE_TYPES.ROOK, false], [PIECE_TYPES.KNIGHT, false], [PIECE_TYPES.BISHOP, false], [PIECE_TYPES.ADVISOR, false], [PIECE_TYPES.KING, false], [PIECE_TYPES.ADVISOR, false], [PIECE_TYPES.KNIGHT, false], [PIECE_TYPES.BISHOP, false], [PIECE_TYPES.ROOK, false]],
        [null, null, null, null, null, null, null, null, null],
        [null, [PIECE_TYPES.CANNON, false], null, null, null, null, null, [PIECE_TYPES.CANNON, false], null],
        [[PIECE_TYPES.PAWN, false], null, [PIECE_TYPES.PAWN, false], null, [PIECE_TYPES.PAWN, false], null, [PIECE_TYPES.PAWN, false], null, [PIECE_TYPES.PAWN, false]],
        [null, null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null],
        // 白方
        [[PIECE_TYPES.PAWN, true], null, [PIECE_TYPES.PAWN, true], null, [PIECE_TYPES.PAWN, true], null, [PIECE_TYPES.PAWN, true], null, [PIECE_TYPES.PAWN, true]],
        [null, [PIECE_TYPES.CANNON, true], null, null, null, null, null, [PIECE_TYPES.CANNON, true], null],
        [null, null, null, null, null, null, null, null, null],
        [[PIECE_TYPES.ROOK, true], [PIECE_TYPES.BISHOP, true], [PIECE_TYPES.KNIGHT, true], [PIECE_TYPES.ADVISOR, true], [PIECE_TYPES.KING, true], [PIECE_TYPES.ADVISOR, true], [PIECE_TYPES.BISHOP, true], [PIECE_TYPES.KNIGHT, true], [PIECE_TYPES.ROOK, true]]
    ];

    // 初始化棋盘
    const chessboard = document.getElementById('chessboard');
    const statusText = document.getElementById('statusText');
    const currentPlayerText = document.getElementById('currentPlayer');
    const turnIndicator = document.getElementById('turnIndicator');
    const gameModeText = document.getElementById('gameModeText');
    const modeBtn = document.getElementById('modeBtn');
    
    // 初始化棋盘
    function initBoard() {
        chessboard.innerHTML = '';
        gameState.board = JSON.parse(JSON.stringify(initialSetup));
        gameState.currentPlayer = true;
        gameState.selectedPiece = null;
        gameState.gameOver = false;
        gameState.moveHistory = [];
        gameState.possibleMoves = [];
        gameState.historyIndex = -1;
        gameState.repetitionCount.clear();
        gameState.aiThinking = false;
        
        statusText.textContent = '白方回合，请走棋';
        currentPlayerText.textContent = '白方回合';
        turnIndicator.style.background = 'white';

        // 创建棋盘格子
        chessboard.innerHTML = '';
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const cell = document.createElement('div');
                cell.className = `cell ${(row + col) % 2 === 0 ? 'white-cell' : 'black-cell'}`;
                cell.dataset.row = row;
                cell.dataset.col = col;
                cell.addEventListener('click', handleCellClick);
                chessboard.appendChild(cell);
            }
        }

        // 使用放置初始棋子
        updateBoard();
    
        // 获取棋盘格子的尺寸
        const firstCell = document.querySelector('.cell');
        const cellSize = firstCell.offsetWidth;

        // 上方九宫格外边框
        const topPalaceBorder = document.createElement('div');
        topPalaceBorder.className = 'palace-border';
        topPalaceBorder.style.top = '0px';
        topPalaceBorder.style.left = `${3 * cellSize}px`; // 3 * cellSize
        topPalaceBorder.style.width = `${3 * cellSize}px`; // 3 * cellSize
        topPalaceBorder.style.height = `${3 * cellSize}px`; // 3 * cellSize
        chessboard.appendChild(topPalaceBorder);
        
        // 下方九宫格外边框
        const bottomPalaceBorder = document.createElement('div');
        bottomPalaceBorder.className = 'palace-border';
        bottomPalaceBorder.style.top = `${7 * cellSize}px`; // 7 * cellSize
        bottomPalaceBorder.style.left = `${3 * cellSize}px`; // 3 * cellSize
        bottomPalaceBorder.style.width = `${3 * cellSize}px`; // 3 * cellSize
        bottomPalaceBorder.style.height = `${3 * cellSize}px`; // 3 * cellSize
        chessboard.appendChild(bottomPalaceBorder);
        
        // 创建河界标识（只在第5行底部显示）
        const riverHighlight = document.createElement('div');
        riverHighlight.className = 'river-highlight';
        riverHighlight.style.top = `${5 * cellSize}px`; // 5 * cellSize
        riverHighlight.style.left = '0px';
        riverHighlight.style.width = `${9 * cellSize}px`; // 9 * cellSize
        chessboard.appendChild(riverHighlight);
        
        // 清除走子提示标记
        clearMoveIndicators();

        // 如果是人机对战且AI先手，则触发AI移动
        if (gameState.gameMode === 'pvc' && gameState.currentPlayer === 'black') {
            setTimeout(makeAIMove, 500);
        }
    }
    
    // 创建棋子元素
    function createPieceElement(piece, row, col) {
        if (!piece) return null;
        
        const [type, isWhite] = piece;
        const pieceElement = document.createElement('div');
        const player = isWhite ? 'white' : 'black';
        pieceElement.className = `piece ${player}`;
        pieceElement.textContent = pieceChars[type][isWhite];
        pieceElement.dataset.piece = `${type}_${isWhite}`;
        pieceElement.dataset.row = row;
        pieceElement.dataset.col = col;
        pieceElement.addEventListener('click', handlePieceClick);
        return pieceElement;
    }

    // 更新棋盘显示
    function updateBoard() {
        // 清空所有棋子
        document.querySelectorAll('.piece').forEach(piece => piece.remove());
        
        // 根据当前board状态放置棋子
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = gameState.board[row][col];
                if (piece) {
                    const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
                    const pieceElement = createPieceElement(piece, row, col);
                    cell.appendChild(pieceElement);
                }
            }
        }
    }

    // 切换游戏模式
    modeBtn.addEventListener('click', () => {
        if (gameState.gameMode === 'pvp') {
            gameState.gameMode = 'pvc';
            modeBtn.textContent = '切换为双人对战';
            gameModeText.textContent = '人机对战';
        } else {
            gameState.gameMode = 'pvp';
            modeBtn.textContent = '切换为人机对战';
            gameModeText.textContent = '双人对战';
        }
        initBoard();
    });
    
    // 处理棋子点击
    function handlePieceClick(event) {
        if (gameState.gameOver) return;
        
        // 如果是人机对战模式且AI正在思考，禁用点击
        if (gameState.gameMode === 'pvc' && gameState.aiThinking) return;
        
        event.stopPropagation();
        const pieceElement = event.target;
        const [type, isWhite] = gameState.board[pieceElement.dataset.row][pieceElement.dataset.col];
        const player = isWhite ? 'white' : 'black';
        const row = parseInt(pieceElement.dataset.row);
        const col = parseInt(pieceElement.dataset.col);
        
        // 如果已经有选中的棋子
        if (gameState.selectedPiece) {
            // 检查是否点击了可被吃的棋子
            const isMoveValid = gameState.possibleMoves.some(move => 
                move[0] === row && move[1] === col
            );
            
            if (isMoveValid && isWhite !== gameState.currentPlayer) {
                // 执行吃子操作
                movePiece(gameState.selectedPiece.row, gameState.selectedPiece.col, row, col);
                return;
            }
            
            // 如果点击的是自己的棋子，切换选中状态
            if (isWhite === gameState.currentPlayer) {
                // 清除之前的选择
                clearSelection();
                
                // 选中当前棋子
                pieceElement.classList.add('selected');
                gameState.selectedPiece = {
                    element: pieceElement,
                    piece: [type, isWhite],
                    row: row,
                    col: col
                };
                
                // 显示可行走位置
                showPossibleMoves(row, col, type, isWhite);
                return;
            }
        }
        
        // 只能选择当前玩家的棋子
        if (isWhite !== gameState.currentPlayer) return;
        
        // 清除之前的选择
        clearSelection();
        
        // 选中当前棋子
        pieceElement.classList.add('selected');
        gameState.selectedPiece = {
            element: pieceElement,
            piece: [type, isWhite],
            row: row,
            col: col
        };
        
        // 显示可行走位置
        showPossibleMoves(row, col, type, isWhite);
    }
    
    // 处理格子点击
    function handleCellClick(event) {
        if (gameState.gameOver || !gameState.selectedPiece) return;
        
        // 如果是人机对战模式且AI正在思考，禁用点击
        if (gameState.gameMode === 'pvc' && gameState.aiThinking) return;
        
        const cell = event.currentTarget;
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        
        // 检查是否是可行走位置
        const isMoveValid = gameState.possibleMoves.some(move => 
            move[0] === row && move[1] === col
        );
        
        if (!isMoveValid) return;
        
        // 执行移动
        const [selectedType, selectedIsWhite] = gameState.selectedPiece.piece;
        movePiece(gameState.selectedPiece.row, gameState.selectedPiece.col, row, col);
    }
    
    // 棋子基础移动规则
    function getBasicMoves(row, col, piece) {
        const moves = [];
        const [type, isWhite] = piece;
        
        switch (type) {
            case PIECE_TYPES.ROOK: // 车
                // 水平方向
                for (let c = col - 1; c >= 0; c--) {
                    if (!addMoveIfValid(row, c, isWhite, moves)) break;
                }
                for (let c = col + 1; c < 9; c++) {
                    if (!addMoveIfValid(row, c, isWhite, moves)) break;
                }
                // 垂直方向
                for (let r = row - 1; r >= 0; r--) {
                    if (!addMoveIfValid(r, col, isWhite, moves)) break;
                }
                for (let r = row + 1; r < 10; r++) {
                    if (!addMoveIfValid(r, col, isWhite, moves)) break;
                }
                break;
                
            case PIECE_TYPES.KNIGHT: // 马
                const knightMoves = [
                    [row - 2, col - 1], [row - 2, col + 1], // 上
                    [row - 1, col - 2], [row - 1, col + 2], // 左上、右上
                    [row + 1, col - 2], [row + 1, col + 2], // 左下、右下
                    [row + 2, col - 1], [row + 2, col + 1]  // 下
                ];
                
                knightMoves.forEach(([r, c]) => {
                    // 检查蹩马腿
                    if (r >= 0 && r < 10 && c >= 0 && c < 9) {
                        const legRow = row + Math.sign(r - row) * (Math.abs(r - row) > 1 ? 1 : 0);
                        const legCol = col + Math.sign(c - col) * (Math.abs(c - col) > 1 ? 1 : 0);
                        
                        if (gameState.board[legRow][legCol] === null) {
                            addMoveIfValid(r, c, isWhite, moves);
                        }
                    }
                });
                break;
                
            case PIECE_TYPES.BISHOP: // 象（国际象棋规则）
                // 四个斜线方向
                const directions = [
                    [-1, -1], [-1, 1], [1, -1], [1, 1]
                ];
                
                directions.forEach(([dr, dc]) => {
                    for (let i = 1; i < 9; i++) {
                        const r = row + dr * i;
                        const c = col + dc * i;
                        
                        if (r < 0 || r >= 10 || c < 0 || c >= 9) break;
                        
                        if (!addMoveIfValid(r, c, isWhite, moves)) break;
                    }
                });
                break;
                
            case PIECE_TYPES.ADVISOR: // 士
                const advisorMoves = [
                    [row - 1, col - 1], [row - 1, col + 1],
                    [row + 1, col - 1], [row + 1, col + 1]
                ];
                
                advisorMoves.forEach(([r, c]) => {
                    if (r >= 0 && r < 10 && c >= 3 && c <= 5) {
                        if (isWhite && r >= 7) {
                            addMoveIfValid(r, c, isWhite, moves);
                        } else if (!isWhite && r <= 2) {
                            addMoveIfValid(r, c, isWhite, moves);
                        }
                    }
                });
                break;
                

            case PIECE_TYPES.KING: // 将帅
                const kingMoves = [
                    [row - 1, col], [row + 1, col],
                    [row, col - 1], [row, col + 1]
                ];
                
                kingMoves.forEach(([r, c]) => {
                    if (r >= 0 && r < 10 && c >= 3 && c <= 5) {
                        if (isWhite && r >= 7) {
                            addMoveIfValid(r, c, isWhite, moves);
                        } else if (!isWhite && r <= 2) {
                            addMoveIfValid(r, c, isWhite, moves);
                        }
                    }
                });
                
                // 将帅对脸规则
                for (let r = row - 1; r >= 0; r--) {
                    const targetPiece = gameState.board[r][col];
                    if (targetPiece) {
                        if (targetPiece[0] === PIECE_TYPES.KING && targetPiece[1] !== isWhite) {
                            let hasPieceBetween = false;
                            for (let i = row - 1; i > r; i--) {
                                if (gameState.board[i][col]) {
                                    hasPieceBetween = true;
                                    break;
                                }
                            }
                            if (!hasPieceBetween) {
                                moves.push([r, col]);
                            }
                        }
                        break;
                    }
                }
                break;
                
            case PIECE_TYPES.CANNON: // 炮
                // 水平方向
                let hasJumped = false;
                for (let c = col - 1; c >= 0; c--) {
                    if (!processCannonMove(row, c, isWhite, moves, hasJumped)) {
                        if (gameState.board[row][c]) hasJumped = true;
                    } else {
                        break;
                    }
                }
                
                hasJumped = false;
                for (let c = col + 1; c < 9; c++) {
                    if (!processCannonMove(row, c, isWhite, moves, hasJumped)) {
                        if (gameState.board[row][c]) hasJumped = true;
                    } else {
                        break;
                    }
                }
                
                // 垂直方向
                hasJumped = false;
                for (let r = row - 1; r >= 0; r--) {
                    if (!processCannonMove(r, col, isWhite, moves, hasJumped)) {
                        if (gameState.board[r][col]) hasJumped = true;
                    } else {
                        break;
                    }
                }
                
                hasJumped = false;
                for (let r = row + 1; r < 10; r++) {
                    if (!processCannonMove(r, col, isWhite, moves, hasJumped)) {
                        if (gameState.board[r][col]) hasJumped = true;
                    } else {
                        break;
                    }
                }
                break;
                
            case PIECE_TYPES.PAWN: // 兵/卒
                const pawnMoves = [];
                if (isWhite) {
                    // 白方向上移动
                    pawnMoves.push([row - 1, col]);
                    if (row <= 4) { // 过河后可以左右移动
                        pawnMoves.push([row, col - 1], [row, col + 1]);
                    }
                } else {
                    // 黑方向下移动
                    pawnMoves.push([row + 1, col]);
                    if (row >= 5) { // 过河后可以左右移动
                        pawnMoves.push([row, col - 1], [row, col + 1]);
                    }
                }
                
                pawnMoves.forEach(([r, c]) => {
                    if (r >= 0 && r < 10 && c >= 0 && c < 9) {
                        addMoveIfValid(r, c, isWhite, moves);
                    }
                });
                break;
        }
        return moves;
    }
    
    // 炮的特殊移动处理
    function processCannonMove(row, col, isWhite, moves, hasJumped) {
        if (row < 0 || row >= 10 || col < 0 || col >= 9) return true;
        
        const targetPiece = gameState.board[row][col];
        
        if (!hasJumped) {
            if (targetPiece) {
                // 遇到棋子后设置hasJumped为true，但该位置不能吃子
                return false;
            }
            moves.push([row, col]);
            return false;
        } else {
            // 已经跳跃过，只能吃子
            if (targetPiece) {
                if (targetPiece && targetPiece[1] !== isWhite) {
                    moves.push([row, col]);
                }
                return targetPiece !== null;
            }
        }
    }
    
    // 辅助函数：添加有效移动
    function addMoveIfValid(row, col, isWhite, moves) {
        if (row < 0 || row >= 10 || col < 0 || col >= 9) return false;
        
        const targetPiece = gameState.board[row][col];
        // 如果目标位置为空或是敌方棋子，可以移动
        if (!targetPiece || targetPiece[1] !== isWhite) {
            moves.push([row, col]);
        }
        
        // 如果目标位置有棋子（无论是己方还是敌方），停止在该方向继续搜索
        return targetPiece === null;
    }
    
    // 辅助函数：检查移动后是否会被将军
    function wouldBeInCheck(fromRow, fromCol, toRow, toCol, isWhite) {
        // 保存原始状态
        const originalPiece = gameState.board[toRow][toCol];
        const movingPiece = gameState.board[fromRow][fromCol];
        
        // 模拟移动
        gameState.board[toRow][toCol] = movingPiece;
        gameState.board[fromRow][fromCol] = null;
        
        // 找到己方将/帅的位置
        let kingPos = null;

        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = gameState.board[row][col];
                if (piece && piece[0] === PIECE_TYPES.KING && piece[1] === isWhite) {
                    kingPos = { row, col };
                    break;
                }
            }
            if (kingPos) break;
        }
        
        // 检查是否被将军
        let inCheck = false;
        if (kingPos) {
            inCheck = isSquareAttacked(kingPos.row, kingPos.col, isWhite);
        }
        
        // 恢复原始状态
        gameState.board[fromRow][fromCol] = movingPiece;
        gameState.board[toRow][toCol] = originalPiece;
        
        return inCheck;
    }

    // 获取合法移动位置（过滤被将军走法）
    function getPossibleMoves(row, col, type, isWhite) {
        const moves = getBasicMoves(row, col, [type, isWhite]);
        // 过滤掉会导致己方被将军的移动
        return moves.filter(move => !wouldBeInCheck(row, col, move[0], move[1], isWhite));
    }
    
    // 显示合法移动位置
    function showPossibleMoves(row, col, type, isWhite) {
        clearPossibleMoves();
        
        const moves = getPossibleMoves(row, col, type, isWhite);
        
        // 保存可移动位置
        gameState.possibleMoves = moves;
        
        moves.forEach(move => {
            const [targetRow, targetCol] = move;
            const targetPiece = gameState.board[targetRow][targetCol];
            
            if (targetPiece) {
                // 吃子位置 - 红色边框
                const marker = document.createElement('div');
                marker.className = 'possible-capture';
                marker.dataset.row = targetRow;
                marker.dataset.col = targetCol;
                
                const cell = document.querySelector(`.cell[data-row="${targetRow}"][data-col="${targetCol}"]`);
                cell.appendChild(marker);
            } else {
                // 空位置 - 绿色圆点
                const marker = document.createElement('div');
                marker.className = 'possible-move';
                marker.dataset.row = targetRow;
                marker.dataset.col = targetCol;
                
                const cell = document.querySelector(`.cell[data-row="${targetRow}"][data-col="${targetCol}"]`);
                cell.appendChild(marker);
            }
        });
    }
    
    // 检查玩家是否被将死或困毙
    function isPlayerMated(isWhite) {
        // 检查玩家是否有任何合法移动
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = gameState.board[row][col];
                
                // 找到该玩家的棋子
                if (piece && piece[1] === isWhite) {
                    const type = piece[0];
                    // 获取所有可能的移动
                    const moves = getPossibleMoves(row, col, type, isWhite);
                    // 如果有任何一个合法移动，玩家未被将死
                    if (moves.length > 0) {
                        return false;
                    }
                }
            }
        }

        // 没有合法移动，被将死或困毙
        return true;
    }
    
    // 检查某个位置是否被对方攻击
    function isSquareAttacked(row, col, isWhite) {
        
        // 检查所有敌方棋子
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = gameState.board[r][c];
                if (piece && piece[1] !== isWhite) {
                    const moves = getBasicMoves(r, c, piece);
                    if (moves.some(move => move[0] === row && move[1] === col)) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    // 检查当前玩家是否被将军
    function isInCheck(isWhite) {
        // 找到该玩家的将/帅位置
        let kingPos = null;
        
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = gameState.board[row][col];
                if (piece && piece[0] === PIECE_TYPES.KING && piece[1] === isWhite) {
                    kingPos = { row, col };
                    break;
                }
            }
            if (kingPos) break;
        }
        
        // 如果找不到将/帅，返回false
        if (!kingPos) return false;
        
        // 检查将/帅是否被攻击
        return isSquareAttacked(kingPos.row, kingPos.col, isWhite);
    }

    // 添加走子提示标记
    function addMoveIndicator(row, col, isWhite) {
        const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        if (cell) {
            // 检查是否已有标记，如果有则先移除
            const existingIndicator = cell.querySelector('.move-indicator');
            if (existingIndicator) {
                existingIndicator.remove();
            }
            
            const indicator = document.createElement('div');
            indicator.className = `move-indicator ${isWhite ? 'white' : 'black'}`;
            cell.appendChild(indicator);
        }
    }
    
    // 清除所有走子提示标记
    function clearMoveIndicators() {
        document.querySelectorAll('.move-indicator').forEach(marker => marker.remove());
    }

    // 移动棋子
    function movePiece(fromRow, fromCol, toRow, toCol) {
        const piece = gameState.board[fromRow][fromCol];
        const targetPiece = gameState.board[toRow][toCol];
        const pieceElement = document.querySelector(`.piece[data-row="${fromRow}"][data-col="${fromCol}"]`);
        
        // 计算移动距离
        const fromCell = document.querySelector(`.cell[data-row="${fromRow}"][data-col="${fromCol}"]`);
        const toCell = document.querySelector(`.cell[data-row="${toRow}"][data-col="${toCol}"]`);
        const deltaX = toCell.offsetLeft - fromCell.offsetLeft;
        const deltaY = toCell.offsetTop - fromCell.offsetTop;
        
        // 应用移动动画
        pieceElement.classList.add('moving');
        pieceElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        
        // 等待动画完成后更新棋盘状态
        setTimeout(() => {
            // 移除moving类
            pieceElement.classList.remove('moving');

            // 执行移动
            gameState.board[fromRow][fromCol] = null;
            gameState.board[toRow][toCol] = piece;

            // 如果当前不在历史记录的末尾，删除后面的记录
            if (gameState.historyIndex < gameState.boardHistory.length - 1) {
                // 清理被删除记录的重复计数
                for (let i = gameState.historyIndex + 1; i < gameState.boardHistory.length; i++) {
                    const boardState = JSON.stringify(gameState.boardHistory[i]);
                    const count = gameState.repetitionCount.get(boardState);
                    if (count === 1) {
                        gameState.repetitionCount.delete(boardState);
                    } else {
                        gameState.repetitionCount.set(boardState, count - 1);
                    }
                }
                gameState.boardHistory = gameState.boardHistory.slice(0, gameState.historyIndex + 1);
            }

            // 保存移动后棋盘状态
            const currentBoard = JSON.parse(JSON.stringify(gameState.board));
            gameState.boardHistory.push(currentBoard);
            gameState.historyIndex++;

            // 如果超过最大历史记录数，删除最早的记录
            if (gameState.boardHistory.length > gameState.maxHistorySize) {
                const removedBoard = gameState.boardHistory.shift();
                gameState.historyIndex--;
                // 清理被删除记录的重复计数
                const boardState = JSON.stringify(removedBoard);
                const count = gameState.repetitionCount.get(boardState);
                if (count === 1) {
                    gameState.repetitionCount.delete(boardState);
                } else {
                    gameState.repetitionCount.set(boardState, count - 1);
                }
            }

            // 更新重复局面计数
            const boardState = JSON.stringify(gameState.board);
            const count = gameState.repetitionCount.get(boardState) || 0;
            gameState.repetitionCount.set(boardState, count + 1);

            // 检查是否形成三步重复局面
            if (count >= 2) {
                statusText.innerHTML = `<span style="color:yellow;font-weight:bold;">和棋！三次出现重复局面</span>`;
                currentPlayerText.textContent = '游戏结束';
                turnIndicator.style.background = 'transparent';
                gameState.gameOver = true;
                return;
            }

            // 清除所有旧的走子标记
            clearMoveIndicators();

            // 更新棋盘状态
            gameState.board[fromRow][fromCol] = null;
            gameState.board[toRow][toCol] = piece;
            
            // 更新界面
            updateBoard();
            
            // 添加走子提示标记（原位置和新位置）
            addMoveIndicator(fromRow, fromCol, piece[1]);
            addMoveIndicator(toRow, toCol, piece[1]);
            
            // 清除选择
            clearSelection();
            clearPossibleMoves();
            
            // 检查是否将死或困毙对方
            const opponent = !gameState.currentPlayer;
            if (isPlayerMated(opponent)) {
                gameState.gameOver = true;
                statusText.innerHTML = `<span style="color:gold;font-weight:bold;">${gameState.currentPlayer ? '白方' : '黑方'}胜利！</span>`;
                currentPlayerText.textContent = '游戏结束';
                turnIndicator.style.background = 'transparent';
                updateBoard();
                return;
            }
            
            if (!gameState.gameOver) {
                // 切换玩家
                gameState.currentPlayer = !gameState.currentPlayer;
                
                // 检查新回合的玩家是否被将军
                const inCheck = isInCheck(gameState.currentPlayer);
        
                if (inCheck) {
                    statusText.innerHTML = `<span style="color:red;font-weight:bold;">${gameState.currentPlayer === 'white' ? '白方' : '黑方'}被将军！</span>`;
                    currentPlayerText.textContent = `${gameState.currentPlayer ? '白方' : '黑方'}回合（将军）`;
                } else {
                    statusText.textContent = `${gameState.currentPlayer ? '白方' : '黑方'}回合，请走棋`;
                    currentPlayerText.textContent = `${gameState.currentPlayer ? '白方' : '黑方'}回合`;
                }
                
                turnIndicator.style.background = gameState.currentPlayer ? 'white' : 'black';

                // 如果是人机对战且轮到AI，则触发AI移动
                if (gameState.gameMode === 'pvc' && !gameState.currentPlayer && !gameState.gameOver) {
                    setTimeout(makeAIMove, 500);
                }
            }
        }, 300); // 与CSS过渡时间保持一致
    }
  
    // 清除选择
    function clearSelection() {
        document.querySelectorAll('.piece.selected').forEach(piece => {
            piece.classList.remove('selected');
        });
        gameState.selectedPiece = null;
        gameState.possibleMoves = [];
    }
    
    // 清除可行走标记
    function clearPossibleMoves() {
        document.querySelectorAll('.possible-move, .possible-capture').forEach(marker => {
            marker.remove();
        });
    }
    
    // 事件监听
    document.getElementById('restartBtn').addEventListener('click', initBoard);
    document.getElementById('undoBtn').addEventListener('click', undoMove);
    
    // 悔棋功能
    function undoMove() {
        if (gameState.historyIndex <= 0 || gameState.gameOver) return;
        
        // 移动到上一个历史记录
        gameState.historyIndex--;
        gameState.board = JSON.parse(JSON.stringify(gameState.boardHistory[gameState.historyIndex]));
        
        // 更新重复局面计数
        const boardState = JSON.stringify(gameState.board);
        const count = gameState.repetitionCount.get(boardState) || 0;
        if (count > 0) {
            gameState.repetitionCount.set(boardState, count - 1);
        }
                  
        // 恢复玩家回合
        gameState.currentPlayer = !gameState.currentPlayer;
        gameState.gameOver = false;
        
        // 更新界面
        updateBoard();

        // 显示上一步的走子提示
        if (gameState.moveHistory.length > 0) {
            const prevMove = gameState.moveHistory[gameState.moveHistory.length - 1];
            addMoveIndicator(prevMove.fromRow, prevMove.fromCol, prevMove.pieceMoved[1]);
        }

        statusText.textContent = `${gameState.currentPlayer ? '白方' : '黑方'}回合，请走棋`;
        currentPlayerText.textContent = `${gameState.currentPlayer ? '白方' : '黑方'}回合`;
        turnIndicator.style.background = gameState.currentPlayer ? 'white' : 'black';
    }

    // 初始化时添加难度按钮事件监听
    const easyBtn = document.getElementById('easyBtn');
    const mediumBtn = document.getElementById('mediumBtn');
    const hardBtn = document.getElementById('hardBtn');
    
    easyBtn.addEventListener('click', () => setDifficulty('easy'));
    mediumBtn.addEventListener('click', () => setDifficulty('medium'));
    hardBtn.addEventListener('click', () => setDifficulty('hard'));
    
    // 设置难度函数
    function setDifficulty(difficulty) {
        gameState.aiDifficulty = difficulty;
        
        // 更新按钮样式
        easyBtn.classList.remove('active');
        mediumBtn.classList.remove('active');
        hardBtn.classList.remove('active');
        
        document.getElementById(`${difficulty}Btn`).classList.add('active');
        
        statusText.textContent = `已设置为${getDifficultyName(difficulty)}难度`;
        setTimeout(() => {
            if (!gameState.aiThinking && gameState.currentPlayer === 'black' && gameState.gameMode === 'pvc') {
                statusText.textContent = '黑方回合，请走棋';
            }
        }, 1000);
    }
    
    // 初始化游戏
    initBoard();

    // AI

    // 评估棋子阶段性价值
    function evaluatePieceStageValue(pieceType, row, isWhite) {
        let stageValue = 0;
        
        switch(pieceType) {
            case PIECE_TYPES.CANNON:
                if (row >= 3 && row <= 6) stageValue = 0.5;
                break;
            case PIECE_TYPES.BISHOP:
                const totalPieces = gameState.board.flat().filter(x => x !== null).length;
                if (totalPieces < 20) stageValue = 0.5;
                break;
            case PIECE_TYPES.PAWN:
                if ((isWhite && row <= 4) || (!isWhite && row >= 5)) {
                    stageValue = 0.5;
                }
                break;
        }
        
        return stageValue;
    }

    // 棋子位置价值表
    const positionValues = {
        [PIECE_TYPES.PAWN]: [  // 兵/卒
            [0,  0,  0,  0,  0,  0,  0,  0,  0],
            [0,  0,  0,  0,  0,  0,  0,  0,  0],
            [0,  0,  0,  0,  0,  0,  0,  0,  0],
            [1,  0,  1,  0,  1,  0,  1,  0,  1],
            [2,  0,  2,  0,  2,  0,  2,  0,  2],
            [4,  4,  4,  4,  4,  4,  4,  4,  4],
            [4,  4,  4,  4,  4,  4,  4,  4,  4],
            [5,  5,  5,  5,  5,  5,  5,  5,  5],
            [5,  5,  5,  5,  5,  5,  5,  5,  5],
            [0,  1,  2,  3,  3,  3,  2,  1,  0]
        ],
        [PIECE_TYPES.CANNON]: [  // 炮
            [1,  1,  1,  1,  1,  1,  1,  1,  1],
            [1,  1,  1,  1,  1,  1,  1,  1,  1],
            [2,  1,  2,  2,  4,  2,  2,  1,  2],
            [1,  1,  1,  1,  4,  1,  1,  1,  1],
            [2,  2,  2,  2,  4,  2,  2,  2,  2],
            [2,  2,  2,  2,  4,  2,  2,  2,  2],
            [2,  2,  2,  2,  4,  2,  2,  2,  2],
            [2,  1,  1,  2,  3,  2,  1,  1,  2],
            [2,  1,  1,  1,  1,  1,  1,  1,  2],
            [3,  3,  2,  1,  1,  1,  2,  3,  3]
        ],
        [PIECE_TYPES.KNIGHT]: [  // 马
            [0,  1,  1,  1,  1,  1,  1,  1,  0],
            [1,  1,  1,  1,  1,  1,  1,  1,  1],
            [1,  2,  3,  2,  2,  2,  3,  2,  1],
            [1,  2,  2,  2,  3,  2,  2,  2,  1],
            [1,  2,  2,  3,  3,  3,  2,  2,  1],
            [1,  2,  2,  3,  3,  3,  2,  2,  1],
            [1,  2,  3,  2,  3,  2,  3,  2,  1],
            [1,  2,  3,  3,  1,  3,  3,  2,  1],
            [1,  2,  3,  2,  1,  2,  3,  2,  1],
            [0,  1,  1,  1,  1,  1,  1,  1,  0]
        ],
        [PIECE_TYPES.BISHOP]: [  // 象
            [1,  1,  1,  1,  1,  1,  1,  1,  1],
            [1,  2,  2,  2,  2,  2,  2,  2,  1],
            [1,  2,  3,  3,  3,  3,  3,  2,  1],
            [1,  2,  3,  4,  4,  4,  3,  2,  1],
            [1,  2,  3,  4,  5,  4,  3,  2,  1],
            [1,  2,  3,  4,  5,  4,  3,  2,  1],
            [1,  2,  3,  4,  4,  4,  3,  2,  1],
            [1,  2,  3,  3,  3,  3,  3,  2,  1],
            [1,  2,  2,  2,  2,  2,  2,  2,  1],
            [1,  1,  1,  1,  1,  1,  1,  1,  1]
        ],
        [PIECE_TYPES.ADVISOR]: [  // 士
            [0,  0,  0,  0,  0,  0,  0,  0,  0],
            [0,  0,  0,  0,  0,  0,  0,  0,  0],
            [0,  0,  0,  0,  0,  0,  0,  0,  0],
            [0,  0,  0,  0,  0,  0,  0,  0,  0],
            [0,  0,  0,  0,  0,  0,  0,  0,  0],
            [0,  0,  0,  0,  0,  0,  0,  0,  0],
            [0,  0,  0,  0,  0,  0,  0,  0,  0],
            [0,  0,  0,  2,  0,  2,  0,  0,  0],
            [0,  0,  0,  0,  3,  0,  0,  0,  0],
            [0,  0,  0,  2,  0,  2,  0,  0,  0]
        ],
        [PIECE_TYPES.ROOK]: [  // 车
            [2,  4,  2,  3,  1,  3,  2,  4,  2],
            [2,  4,  2,  3,  1,  3,  2,  4,  2],
            [2,  4,  2,  3,  2,  3,  2,  4,  2],
            [2,  4,  2,  3,  2,  3,  2,  4,  2],
            [4,  4,  4,  4,  4,  4,  4,  4,  4],
            [4,  4,  4,  4,  4,  4,  4,  4,  4],
            [2,  4,  2,  3,  3,  3,  2,  4,  2],
            [2,  4,  2,  3,  3,  3,  2,  4,  2],
            [2,  4,  2,  3,  3,  3,  2,  4,  2],
            [4,  4,  4,  4,  2,  4,  4,  4,  4]
        ],
        [PIECE_TYPES.KING]: [  // 帅/将
            [0,  0,  0,  1,  1,  1,  0,  0,  0],
            [0,  0,  0,  1,  1,  1,  0,  0,  0],
            [0,  0,  0,  1,  1,  1,  0,  0,  0],
            [0,  0,  0,  0,  0,  0,  0,  0,  0],
            [0,  0,  0,  0,  0,  0,  0,  0,  0],
            [0,  0,  0,  0,  0,  0,  0,  0,  0],
            [0,  0,  0,  0,  0,  0,  0,  0,  0],
            [0,  0,  0,  1,  1,  1,  0,  0,  0],
            [0,  0,  0,  1,  1,  1,  0,  0,  0],
            [0,  0,  0,  1,  1,  1,  0,  0,  0]
        ]
    };

    // 评估棋子位置价值
    function evaluatePositionValues() {
        let score = 0;
        
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = gameState.board[row][col];
                if (piece) {
                    const [type, isWhite] = piece;
                    const positionValue = positionValues[type][isWhite ? (9 - row) : row][col];
                    score += isWhite ? -positionValue : positionValue;
                }
            }
        }
        
        return score;
    }

    // 棋子活动性评估
    function evaluateMobility() {
        let score = 0;
        const importantPieces = [PIECE_TYPES.ROOK, PIECE_TYPES.KNIGHT, PIECE_TYPES.CANNON, PIECE_TYPES.BISHOP];
        
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = gameState.board[row][col];
                if (piece) {
                    const [type, isWhite] = piece;
                    if (importantPieces.includes(type)) {
                        const moves = getPossibleMoves(row, col, type, isWhite);
                        const mobility = moves.length;
                        score += isWhite ? -mobility : mobility;
                    }
                }
            }
        }
        return score;
    }

    function minimax(depth, alpha, beta, isMaximizing, currentDepth) {
        if (depth === 0) {
            return evaluateBoard();
        }

        const isWhite = !isMaximizing;
        let possibleMoves = getAllPossibleMoves(isWhite);
        
        // 如果没有合法移动，返回极值
        if (possibleMoves.length === 0) {
            return isMaximizing ? -10000 : 10000;
        }
        
        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of possibleMoves) {
                // 执行移动
                const undo = makeAIMoveInternal(move);
                
                // 递归评估
                const eval = minimax(depth - 1, alpha, beta, false, currentDepth + 1);
                
                // 撤销移动
                undo();
                
                maxEval = Math.max(maxEval, eval);
                alpha = Math.max(alpha, eval);
                if (beta <= alpha) {
                    break; // Beta剪枝
                }
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of possibleMoves) {
                // 执行移动
                const undo = makeAIMoveInternal(move);
                
                // 递归评估
                const eval = minimax(depth - 1, alpha, beta, true, currentDepth + 1);
                
                // 撤销移动
                undo();
                
                minEval = Math.min(minEval, eval);
                beta = Math.min(beta, eval);
                if (beta <= alpha) {
                    break; // Alpha剪枝
                }
            }
            return minEval;
        }
    }

    // 添加移动排序函数
    function sortMoves(moves) {
        return moves.sort((a, b) => {
            const captureA = gameState.board[a.toRow][a.toCol] !== null;
            const captureB = gameState.board[b.toRow][b.toCol] !== null;
            if (captureA !== captureB) return captureB - captureA;
            
            if (captureA && captureB) {
                const valueA = pieceValues[gameState.board[a.toRow][a.toCol][0]];
                const valueB = pieceValues[gameState.board[b.toRow][b.toCol][0]];
                return valueB - valueA;
            }
            
            return Math.random() - 0.5;
        });
    }

    // 获取所有可能的移动
    function getAllPossibleMoves(isWhite) {
        const moves = [];
        
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = gameState.board[row][col];
                if (piece && piece[1] === isWhite) {
                    const type = piece[0];
                    const pieceMoves = getPossibleMoves(row, col, type, isWhite);
                    
                    for (const [toRow, toCol] of pieceMoves) {
                        moves.push({
                            fromRow: row,
                            fromCol: col,
                            toRow: toRow,
                            toCol: toCol,
                            type: type,
                            captured: gameState.board[toRow][toCol] !== null,
                            score: 0
                        });
                    }
                }
            }
        }
        
        // 简单启发式排序
        moves.sort((a, b) => {
            // 吃子优先
            if (a.captured && !b.captured) return -1;
            if (!a.captured && b.captured) return 1;
            
            // 按照棋子价值排序
            const aValue = a.captured ? pieceValues[gameState.board[a.toRow][a.toCol][0]] : 0;
            const bValue = b.captured ? pieceValues[gameState.board[b.toRow][b.toCol][0]] : 0;
            
            return bValue - aValue;
        });
        
        return moves;
    }

    // 评估棋盘状态
    function evaluateBoard() {
        // 基础分数
        let score = evaluatePositionValues();
        
        // 活动性评估（降低计算频率）
        if (Math.random() < 0.3) { // 只30%的情况下计算活动性
            score += evaluateMobility() * 0.3;
        }
        
        // 棋子数量评估
        let materialCount = 0;
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = gameState.board[row][col];
                if (piece) {
                    const [type, isWhite] = piece;
                    materialCount += isWhite ? -pieceValues[type] : pieceValues[type];
                }
            }
        }
        score += materialCount;
        
        // 检查是否被将军（加成）
        const inCheck = isInCheck(!gameState.currentPlayer);
        if (inCheck) {
            score += gameState.currentPlayer ? 20 : -20;
        }
        
        return score;
    }

    // 寻找最佳移动
    // 内部移动函数（不改UI）
    function makeAIMoveInternal(move) {
        const piece = gameState.board[move.fromRow][move.fromCol];
        const targetPiece = gameState.board[move.toRow][move.toCol];
        
        // 保存原始状态
        const originalFromPiece = gameState.board[move.fromRow][move.fromCol];
        const originalToPiece = gameState.board[move.toRow][move.toCol];
        
        // 执行移动
        gameState.board[move.fromRow][move.fromCol] = null;
        gameState.board[move.toRow][move.toCol] = piece;
        
        // 返回一个撤销函数
        return () => {
            // 恢复原始状态
            gameState.board[move.fromRow][move.fromCol] = originalFromPiece;
            gameState.board[move.toRow][move.toCol] = originalToPiece;
        };
    }

    function findBestMove() {
        const startTime = Date.now();
        const maxTime = 5000; // 限制搜索时间为5秒
        let depth = 1;
        let bestMove = null;
        
        while (Date.now() - startTime < maxTime && depth <= gameState.aiDepths[gameState.aiDifficulty]) {
            let currentBestMove = null;
            let currentBestValue = -Infinity;
            
            const moves = getAllPossibleMoves(gameState.currentPlayer);
            
            for (const move of moves) {
                // 使用内部移动函数
                const undo = makeAIMoveInternal(move);
                
                // 递归评估
                const value = minimax(depth - 1, -Infinity, Infinity, true, 0);
                
                // 撤销移动
                undo();
                
                if (value > currentBestValue) {
                    currentBestValue = value;
                    currentBestMove = move;
                }
            }
            
            bestMove = currentBestMove;
            depth++;
            
            // 更新状态显示
            statusText.textContent = `AI思考中...深度 ${depth-1}`;
        }
        
        return bestMove;
    }

    // AI移动函数，使用当前难度
    function getDifficultyName(difficulty) {
        const names = { easy: '简单', medium: '中等', hard: '困难' };
        return names[difficulty];
    }
    
    function makeAIMove() {
        if (gameState.gameOver || gameState.aiThinking) return;
        
        gameState.aiThinking = true;
        statusText.textContent = `AI思考中 (${getDifficultyName(gameState.aiDifficulty)}难度)...`;
        
        // 根据难度设置思考时间
        const thinkTime = gameState.aiDifficulty === 'easy' ? 500 : 
                        gameState.aiDifficulty === 'medium' ? 800 : 1200;
        
        setTimeout(() => {
            const depth = gameState.aiDepths[gameState.aiDifficulty];
            const bestMove = findBestMove(depth);
            
            if (bestMove) {
                // 使用新的数据结构执行移动
                movePiece(bestMove.fromRow, bestMove.fromCol, bestMove.toRow, bestMove.toCol);
            } else {
                // AI无合法移动，说明被将死或困毙，游戏结束
                gameState.gameOver = true;
                statusText.innerHTML = `<span style="color:gold;font-weight:bold;">白方胜利！</span>`;
                currentPlayerText.textContent = '游戏结束';
                turnIndicator.style.background = 'transparent';
                gameState.aiThinking = false;
                return;
            }
            
            gameState.aiThinking = false;
        }, thinkTime);
    }

});
