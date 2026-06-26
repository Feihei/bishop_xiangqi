document.addEventListener('DOMContentLoaded', () => {

    // 游戏状态
    const gameState = {
        board: [],
        currentPlayer: true, // true为白方，false为黑方
        selectedPiece: null,
        gameOver: false,
        possibleMoves: [],
        boardHistory: [], // 历史走棋记录
        historyIndex: -1,
        maxHistorySize: 1000,
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
    
    // 深拷贝棋盘。board 是 10×9 数组，元素为 null 或 [type, isWhite]。
    // 比 JSON.parse(JSON.stringify()) 快——避免序列化开销，直接逐格拷贝小数组。
    function cloneBoard(src) {
        const dst = new Array(10);
        for (let r = 0; r < 10; r++) {
            const srcRow = src[r];
            const dstRow = new Array(9);
            for (let c = 0; c < 9; c++) {
                const cell = srcRow[c];
                dstRow[c] = cell ? [cell[0], cell[1]] : null;
            }
            dst[r] = dstRow;
        }
        return dst;
    }

    // 初始化棋盘
    function initBoard() {
        gameState.board = cloneBoard(initialSetup);
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
        if (gameState.gameMode === 'pvc' && !gameState.currentPlayer) {
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
    // 更新棋盘显示
    // changedCells（可选）：仅更新变化的格子数组 [{row, col}, ...]，增量更新，更快。
    // 不传则全量重建（用于初始化、悔棋等场景）。
    function updateBoard(changedCells) {
        if (changedCells && changedCells.length > 0) {
            // 增量更新：只刷新变化的格子
            for (const { row, col } of changedCells) {
                const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
                if (!cell) continue;
                // 移除该格子内的棋子 DOM
                const existing = cell.querySelector('.piece');
                if (existing) existing.remove();
                // 如果有新棋子，创建并放置
                const piece = gameState.board[row][col];
                if (piece) {
                    cell.appendChild(createPieceElement(piece, row, col));
                }
            }
        } else {
            // 全量重建
            document.querySelectorAll('.piece').forEach(piece => piece.remove());
            for (let row = 0; row < 10; row++) {
                for (let col = 0; col < 9; col++) {
                    const piece = gameState.board[row][col];
                    if (piece) {
                        const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
                        cell.appendChild(createPieceElement(piece, row, col));
                    }
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
    
    // ============ canAttack 系列：轻量攻击检测 ============
    // 判断 (r1,c1) 的 piece 能否攻击 (r2,c2)。
    // 不生成走法数组，只做数学判断。与 getBasicMoves 逻辑完全一致。
    // 用于 isSquareAttacked 替代 getBasicMoves + moves.some()，大幅减少内存分配。

    // 辅助：检查 (r1,c1) 到 (r2,c2) 同行/列之间是否有阻挡
    function isPathClear(r1, c1, r2, c2) {
        if (r1 === r2) {
            const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
            for (let c = minC + 1; c < maxC; c++) {
                if (gameState.board[r1][c]) return false;
            }
        } else {
            const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
            for (let r = minR + 1; r < maxR; r++) {
                if (gameState.board[r][c1]) return false;
            }
        }
        return true;
    }

    // 辅助：检查对角线路径 (r1,c1)→(r2,c2) 是否无阻挡
    function isDiagonalClear(r1, c1, r2, c2) {
        const dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1);
        let r = r1 + dr, c = c1 + dc;
        while (r !== r2 || c !== c2) {
            if (gameState.board[r][c]) return false;
            r += dr;
            c += dc;
        }
        return true;
    }

    function canPieceAttack(r1, c1, piece, r2, c2) {
        switch (piece[0]) {
            case PIECE_TYPES.ROOK:
                return canRookAttack(r1, c1, r2, c2);
            case PIECE_TYPES.KNIGHT:
                return canKnightAttack(r1, c1, r2, c2);
            case PIECE_TYPES.CANNON:
                return canCannonAttack(r1, c1, r2, c2);
            case PIECE_TYPES.BISHOP:
                return canBishopAttack(r1, c1, r2, c2);
            case PIECE_TYPES.ADVISOR:
                return canAdvisorAttack(r1, c1, piece[1], r2, c2);
            case PIECE_TYPES.KING:
                return canKingAttack(r1, c1, piece[1], r2, c2);
            case PIECE_TYPES.PAWN:
                return canPawnAttack(r1, c1, piece[1], r2, c2);
            default:
                return false;
        }
    }

    // 车：同行或同列，中间无阻挡
    function canRookAttack(r1, c1, r2, c2) {
        if (r1 !== r2 && c1 !== c2) return false;
        if (r1 === r2 && c1 === c2) return false;
        return isPathClear(r1, c1, r2, c2);
    }

    // 马：L 型偏移（8个方向），检查蹩马腿（与 getBasicMoves 的 legRow/legCol 逻辑一致）
    function canKnightAttack(r1, c1, r2, c2) {
        const dr = r2 - r1, dc = c2 - c1;
        const adr = Math.abs(dr), adc = Math.abs(dc);
        // L 型：(2,1) 或 (1,2)
        if (!((adr === 2 && adc === 1) || (adr === 1 && adc === 2))) return false;
        // 蹩马腿位置：先走一步长的方向
        const legRow = r1 + Math.sign(dr) * (adr > 1 ? 1 : 0);
        const legCol = c1 + Math.sign(dc) * (adc > 1 ? 1 : 0);
        return gameState.board[legRow][legCol] === null;
    }

    // 炮：同行或同列。不跳跃时不能吃子（只有空格走法），跳跃后只能吃子。
    // isSquareAttacked 中目标格有棋子（王），所以只有跳跃后恰好落在目标格才算攻击。
    // 即：中间恰好有 1 个棋子（炮架），中间无其他棋子。
    function canCannonAttack(r1, c1, r2, c2) {
        if (r1 !== r2 && c1 !== c2) return false;
        if (r1 === r2 && c1 === c2) return false;
        // 计算中间棋子数量
        let count = 0;
        if (r1 === r2) {
            const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
            for (let c = minC + 1; c < maxC; c++) {
                if (gameState.board[r1][c]) count++;
            }
        } else {
            const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
            for (let r = minR + 1; r < maxR; r++) {
                if (gameState.board[r][c1]) count++;
            }
        }
        // 炮攻击需要恰好 1 个炮架（跳跃）
        return count === 1;
    }

    // 象/相（国际象棋主教走法，对角线无距离限制，可过河）：同对角线，中间无阻挡
    function canBishopAttack(r1, c1, r2, c2) {
        const dr = r2 - r1, dc = c2 - c1;
        if (Math.abs(dr) !== Math.abs(dc) || dr === 0) return false;
        return isDiagonalClear(r1, c1, r2, c2);
    }

    // 士：斜线距离 1，且目标在九宫内
    function canAdvisorAttack(r1, c1, isWhite, r2, c2) {
        const dr = Math.abs(r2 - r1), dc = Math.abs(c2 - c1);
        if (dr !== 1 || dc !== 1) return false;
        // 目标必须在九宫范围内
        if (r2 < 0 || r2 >= 10 || c2 < 3 || c2 > 5) return false;
        if (isWhite && r2 < 7) return false;
        if (!isWhite && r2 > 2) return false;
        return true;
    }

    // 将帅：直线距离 1 + 目标在九宫内，或飞将（同列、中间无阻挡、对面是敌方王）
    function canKingAttack(r1, c1, isWhite, r2, c2) {
        // 普通走法：直线距离 1
        const dr = Math.abs(r2 - r1), dc = Math.abs(c2 - c1);
        if (dr + dc === 1) {
            // 目标在九宫范围内
            if (r2 < 0 || r2 >= 10 || c2 < 3 || c2 > 5) return false;
            if (isWhite && r2 < 7) return false;
            if (!isWhite && r2 > 2) return false;
            return true;
        }
        // 飞将（将帅对脸）：同列、中间无阻挡
        if (c1 === c2 && r1 !== r2) {
            const target = gameState.board[r2][c2];
            if (target && target[0] === PIECE_TYPES.KING && target[1] !== isWhite) {
                return isPathClear(r1, c1, r2, c2);
            }
        }
        return false;
    }

    // 兵/卒：前进 1 格，或过河后左右 1 格
    function canPawnAttack(r1, c1, isWhite, r2, c2) {
        const colDiff = c2 - c1;
        if (isWhite) {
            // 白方向上（dr=-1）
            if (r2 === r1 - 1 && colDiff === 0) return true;
            // 过河后左右
            if (r1 <= 4 && r2 === r1 && Math.abs(colDiff) === 1) return true;
        } else {
            // 黑方向下（dr=+1）
            if (r2 === r1 + 1 && colDiff === 0) return true;
            // 过河后左右
            if (r1 >= 5 && r2 === r1 && Math.abs(colDiff) === 1) return true;
        }
        return false;
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
                
            case PIECE_TYPES.BISHOP: // 象（国际象棋主教走法：对角线无距离限制，可过河。非传统中国象棋"象不过河"规则。）
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
                // 跳过炮架后遇到敌方棋子，可吃子；遇到己方棋子则停止
                if (targetPiece[1] !== isWhite) {
                    moves.push([row, col]);
                }
                return true; // 无论是否吃子，遇到棋子后停止该方向搜索
            }
            // 跳过炮架后遇到空格，继续搜索但不可吃子
            return false;
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
    // kingPosHint（可选）：搜索路径传入缓存的王位置 {row, col}，避免全盘找王。
    //   注意：若走的就是王本身，hint 是走之前的旧位置，需用 (toRow, toCol) 作为新位置。
    function wouldBeInCheck(fromRow, fromCol, toRow, toCol, isWhite, kingPosHint) {
        // 保存原始状态
        const originalPiece = gameState.board[toRow][toCol];
        const movingPiece = gameState.board[fromRow][fromCol];

        // 模拟移动
        gameState.board[toRow][toCol] = movingPiece;
        gameState.board[fromRow][fromCol] = null;

        // 确定己方将/帅位置
        let kingPos;
        if (kingPosHint) {
            // 搜索路径：用缓存。若走的棋子是王本身，新位置是 (toRow, toCol)
            if (movingPiece[0] === PIECE_TYPES.KING) {
                kingPos = { row: toRow, col: toCol };
            } else {
                kingPos = kingPosHint;
            }
        } else {
            // UI 路径：全盘找王
            kingPos = null;
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
    // kingPosHint（可选）：搜索路径透传给 wouldBeInCheck 的缓存王位置。
    function getPossibleMoves(row, col, type, isWhite, kingPosHint) {
        const moves = getBasicMoves(row, col, [type, isWhite]);
        // 过滤掉会导致己方被将军的移动
        return moves.filter(move => !wouldBeInCheck(row, col, move[0], move[1], isWhite, kingPosHint));
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
    
    // 检查玩家是否被将死或困毙（短路优化：找到第一个合法走法即返回 false）
    function isPlayerMated(isWhite) {
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = gameState.board[row][col];
                if (!piece || piece[1] !== isWhite) continue;
                // 逐个检查基础走法的合法性，第一个合法即返回 false
                const basicMoves = getBasicMoves(row, col, piece);
                for (let i = 0; i < basicMoves.length; i++) {
                    if (!wouldBeInCheck(row, col, basicMoves[i][0], basicMoves[i][1], isWhite)) {
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
        
        // 检查所有敌方棋子（用 canPieceAttack 替代 getBasicMoves + moves.some，避免生成走法数组）
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = gameState.board[r][c];
                if (piece && piece[1] !== isWhite) {
                    if (canPieceAttack(r, c, piece, row, col)) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    // 检查当前玩家是否被将军
    // kingPosHint（可选）：搜索路径传入缓存的王位置，避免全盘找王。
    function isInCheck(isWhite, kingPosHint) {
        // 确定该玩家的将/帅位置
        let kingPos;
        if (kingPosHint) {
            kingPos = kingPosHint;
        } else {
            kingPos = null;
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
            const currentBoard = cloneBoard(gameState.board);
            gameState.boardHistory.push(currentBoard);
            gameState.historyIndex++;

            // 记录走子信息（用于悔棋时显示走子标记）
            gameState.moveHistory.push({ fromRow, fromCol, toRow, toCol, pieceMoved: piece, captured: targetPiece });

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
            
            // 更新界面（增量：只刷新 from/to 两个格子）
            updateBoard([{ row: fromRow, col: fromCol }, { row: toRow, col: toCol }]);

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
                return;
            }
            
            if (!gameState.gameOver) {
                // 切换玩家
                gameState.currentPlayer = !gameState.currentPlayer;
                
                // 检查新回合的玩家是否被将军
                const inCheck = isInCheck(gameState.currentPlayer);
        
                if (inCheck) {
                    statusText.innerHTML = `<span style="color:red;font-weight:bold;">${gameState.currentPlayer ? '白方' : '黑方'}被将军！</span>`;
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
        gameState.board = cloneBoard(gameState.boardHistory[gameState.historyIndex]);

        // 同步移除走子记录
        if (gameState.moveHistory.length > 0) {
            gameState.moveHistory.pop();
        }
        
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
            if (!gameState.aiThinking && !gameState.currentPlayer && gameState.gameMode === 'pvc') {
                statusText.textContent = '黑方回合，请走棋';
            }
        }, 1000);
    }
    
    // 初始化游戏
    initBoard();

    // AI

    // ============ Zobrist 哈希基础设施 ============
    // 用 BigInt 实现 64 位键。14 = 7 种棋子类型 × 2 种颜色。
    // 棋子 [type, isWhite] 映射到索引 type * 2 + (isWhite ? 1 : 0)。
    // 注意：键在 findBestMove 内部维护，搜索开始时从棋盘全量重算，
    // 搜索结束后 currentZobristKey 不再被信任（避免污染 UI 路径）。
    const ZOBRIST_PIECE_STATES = 14;
    const zobristTable = Array.from({ length: 10 }, () =>
        Array.from({ length: 9 }, () =>
            Array.from({ length: ZOBRIST_PIECE_STATES }, () => {
            // 64 位随机数（BigInt）。用两段 32 位拼装保证位宽。
            // 注意：BigInt 不支持 >>> 无符号右移，用 0xFFFFFFFF 掩码截到 32 位非负值。
            const lo = BigInt(Math.floor(Math.random() * 0x100000000)) & 0xFFFFFFFFn;
            const hi = BigInt(Math.floor(Math.random() * 0x100000000)) & 0xFFFFFFFFn;
                return (hi << 32n) | lo;
            })
        )
    );
    const zobristBlackToMove = ((BigInt(Math.floor(Math.random() * 0x100000000)) << 32n) |
        BigInt(Math.floor(Math.random() * 0x100000000)));

    // 棋子到 zobristTable 第三维索引的映射
    function zobristPieceIndex(piece) {
        // piece = [type, isWhite]
        return piece[0] * 2 + (piece[1] ? 1 : 0);
    }

    // 当前搜索局面的 Zobrist 键（仅在 findBestMove 搜索期间有效）
    let currentZobristKey = 0n;

    // 搜索专用王位置缓存（仅在 findBestMove 搜索期间有效，消除 wouldBeInCheck/isInCheck 的全盘找王）
    let searchKingPos = { white: { row: 0, col: 0 }, black: { row: 0, col: 0 } };

    // 从当前棋盘全量计算 Zobrist 键。
    // isBlackToMove: 当前是否黑方走棋，决定是否纳入 zobristBlackToMove（默认 true）。
    // 搜索根节点默认为黑方(AI)走，每次 makeAIMoveInternal 后轮次翻转。
    function computeZobristKey(isBlackToMove = true) {
        let key = 0n;
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = gameState.board[row][col];
                if (piece) {
                    key ^= zobristTable[row][col][zobristPieceIndex(piece)];
                }
            }
        }
        if (isBlackToMove) key ^= zobristBlackToMove;
        return key;
    }

    // ============ Transposition Table（置换表） ============
    const TT_EXACT = 0;       // 节点值是精确的（在 (alpha, beta) 之间）
    const TT_LOWER_BOUND = 1; // 下界（来自 fail-high，即 value >= beta）
    const TT_UPPER_BOUND = 2; // 上界（来自 fail-low，即 value <= alpha）
    const TT_MAX_SIZE = 50000;
    const transpositionTable = new Map();

    function ttStore(key, depth, flag, value, bestMove) {
        if (transpositionTable.size >= TT_MAX_SIZE) {
            transpositionTable.clear();
        }
        transpositionTable.set(key, { depth, flag, value, bestMove });
    }

    function ttProbe(key) {
        return transpositionTable.get(key);
    }

    function ttClear() {
        transpositionTable.clear();
    }

    // ============ 杀手走法 + 历史启发 ============
    // killerMoves[ply][2]：每个 ply 层最多记两个引发剪枝的非吃子走法。
    // historyTable[fromIndex][toIndex]：累计历史得分，fromIndex/toIndex = row*9+col。
    const MAX_SEARCH_PLY = 64;
    let killerMoves = [];
    let historyTable = null;

    function initHeuristics() {
        killerMoves = Array.from({ length: MAX_SEARCH_PLY }, () => [null, null]);
        historyTable = Array.from({ length: 90 }, () => new Array(90).fill(0));
    }

    // ============ 评估：棋子位置价值表 ============
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

    // 棋子活动性评估
    // 注意：这里用 getBasicMoves（不含 wouldBeInCheck 过滤），因为活动性只是启发式，
    // 没必要做精确的合法性校验——后者会引入 O(N^4) 的 isSquareAttacked 全盘扫描，
    // 让评估函数慢到不可用。基本走法数量作为活动性近似已经足够。
    function evaluateMobility() {
        let score = 0;
        const importantPieces = [PIECE_TYPES.ROOK, PIECE_TYPES.KNIGHT, PIECE_TYPES.CANNON, PIECE_TYPES.BISHOP];

        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = gameState.board[row][col];
                if (piece) {
                    const [type, isWhite] = piece;
                    if (importantPieces.includes(type)) {
                        const moves = getBasicMoves(row, col, piece);
                        score += isWhite ? -moves.length : moves.length;
                    }
                }
            }
        }
        return score;
    }

    // 搜索超时哨兵：findBestMove 在超时时抛出，由根节点捕获
    const SEARCH_TIMEOUT = Symbol('search_timeout');
    let searchDeadline = 0;
    let searchTimedOut = false;

    function minimax(depth, alpha, beta, isMaximizing, ply) {
        // 超时检查（下沉到内部节点，避免搜一半树）
        if (Date.now() > searchDeadline) {
            searchTimedOut = true;
            throw SEARCH_TIMEOUT;
        }

        // 查置换表
        const ttEntry = ttProbe(currentZobristKey);
        let ttBestMove = null;
        if (ttEntry) {
            ttBestMove = ttEntry.bestMove;
            // 命中且深度足够：按 flag 直接返回边界值
            if (ttEntry.depth >= depth) {
                if (ttEntry.flag === TT_EXACT) {
                    return ttEntry.value;
                } else if (ttEntry.flag === TT_LOWER_BOUND) {
                    if (ttEntry.value > alpha) alpha = ttEntry.value;
                } else if (ttEntry.flag === TT_UPPER_BOUND) {
                    if (ttEntry.value < beta) beta = ttEntry.value;
                }
                if (alpha >= beta) {
                    return ttEntry.value;
                }
            }
        }

        if (depth === 0) {
            // 叶子节点：返回当前局面的评估，sideToMove 为当前要走棋的一方
            // isMaximizing=true ↔ AI(黑方,false) 走；isMaximizing=false ↔ 人(白方,true) 走
            return evaluateBoard(!isMaximizing, searchKingPos);
        }

        const isWhite = !isMaximizing;
        // 当前走棋方的王位置 hint（搜索期间由 makeAIMoveInternal 增量维护）
        const kingPosHint = isWhite ? searchKingPos.white : searchKingPos.black;
        let possibleMoves = getAllPossibleMoves(isWhite, {
            ply,
            ttBestMove,
            killers: killerMoves[ply],
            history: historyTable,
            isMaximizing
        }, kingPosHint);

        // 如果没有合法移动，返回极值（被将死/困毙）
        if (possibleMoves.length === 0) {
            return isMaximizing ? -10000 : 10000;
        }

        const origAlpha = alpha;
        let bestValue = isMaximizing ? -Infinity : Infinity;
        let bestMove = null;

        if (isMaximizing) {
            for (const move of possibleMoves) {
                const undo = makeAIMoveInternal(move);
                let eval;
                try {
                    eval = minimax(depth - 1, alpha, beta, false, ply + 1);
                } finally {
                    undo(); // 超时抛 SEARCH_TIMEOUT 时也保证棋盘/Zobrist 键还原
                }

                if (eval > bestValue) {
                    bestValue = eval;
                    bestMove = move;
                }
                if (eval > alpha) alpha = eval;
                if (beta <= alpha) {
                    // 剪枝：记录杀手走法与历史得分（仅对非吃子走法）
                    if (!move.captured) {
                        recordKillerAndHistory(move, ply);
                    }
                    break; // Beta剪枝
                }
            }
        } else {
            for (const move of possibleMoves) {
                const undo = makeAIMoveInternal(move);
                let eval;
                try {
                    eval = minimax(depth - 1, alpha, beta, true, ply + 1);
                } finally {
                    undo();
                }

                if (eval < bestValue) {
                    bestValue = eval;
                    bestMove = move;
                }
                if (eval < beta) beta = eval;
                if (beta <= alpha) {
                    if (!move.captured) {
                        recordKillerAndHistory(move, ply);
                    }
                    break; // Alpha剪枝
                }
            }
        }

        // 存置换表：根据相对 origAlpha/beta 判断 flag
        let flag;
        if (bestValue <= origAlpha) {
            flag = TT_UPPER_BOUND; // fail-low
        } else if (bestValue >= beta) {
            flag = TT_LOWER_BOUND; // fail-high
        } else {
            flag = TT_EXACT;
        }
        ttStore(currentZobristKey, depth, flag, bestValue, bestMove);

        return bestValue;
    }

    // 记录杀手走法（同一 ply 最多两个，不重复）与历史得分
    function recordKillerAndHistory(move, ply) {
        const slot = killerMoves[ply];
        if (!slot) return;
        // 与已有杀手走法都不相同才记录（去重）
        const sameAs = (m) => m && m.fromRow === move.fromRow && m.fromCol === move.fromCol &&
            m.toRow === move.toRow && m.toCol === move.toCol;
        if (sameAs(slot[0])) return;
        if (sameAs(slot[1])) {
            // 命中第二槽，提升到第一槽
            slot[1] = slot[0];
            slot[0] = move;
            return;
        }
        // 下移：新走法进第一槽，原第一槽降为第二槽
        slot[1] = slot[0];
        slot[0] = move;
        // 历史得分：以深度加权累加，剪枝越靠上层得分越高
        historyTable[move.fromRow * 9 + move.fromCol][move.toRow * 9 + move.toCol] += ply * ply;
    }

    // 获取所有可能的移动，并按启发式排序。
    // heuristics（可选）: { ply, ttBestMove, killers, history, isMaximizing }
    // 获取所有可能的移动，并按启发式排序。
    // heuristics（可选）: { ply, ttBestMove, killers, history, isMaximizing }
    // kingPosHint（可选）: 当前走棋方的王位置，搜索路径透传给 getPossibleMoves 跳过全盘找王
    function getAllPossibleMoves(isWhite, heuristics, kingPosHint) {
        const moves = [];

        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = gameState.board[row][col];
                if (piece && piece[1] === isWhite) {
                    const type = piece[0];
                    const pieceMoves = getPossibleMoves(row, col, type, isWhite, kingPosHint);

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

        // 为每个走法计算排序得分并写入 move.score
        scoreMoves(moves, heuristics);
        moves.sort((a, b) => b.score - a.score);
        return moves;
    }

    // 计算每个走法的排序得分（写入 move.score），确定性的启发式：
    //   TT best move (置顶) > 吃子 MVV-LVA > 杀手走法 > 历史得分
    // MVV-LVA：被吃子价值越高、走子价值越低，越优先（用小棋子吃大棋子）。
    function scoreMoves(moves, heuristics) {
        const ttBest = heuristics && heuristics.ttBestMove;
        const killers = heuristics && heuristics.killers; // [move|null, move|null]
        const history = heuristics && heuristics.history;
        const ply = heuristics ? heuristics.ply : 0;

        for (const move of moves) {
            let s = 0;

            // 1) TT 最佳走法置顶（用大数保证排在最前）
            if (ttBest && move.fromRow === ttBest.fromRow && move.fromCol === ttBest.fromCol &&
                move.toRow === ttBest.toRow && move.toCol === ttBest.toCol) {
                s += 1000000;
            }

            // 2) 吃子走法：MVV-LVA。被吃子价值放大 10 倍减去走子价值。
            if (move.captured) {
                const victim = gameState.board[move.toRow][move.toCol][0];
                const attacker = move.type;
                s += 10000 + pieceValues[victim] * 10 - pieceValues[attacker];
            }

            // 3) 杀手走法（仅非吃子，因为吃子已由 MVV-LVA 覆盖）
            if (!move.captured && killers) {
                for (let i = 0; i < killers.length; i++) {
                    const k = killers[i];
                    if (k && k.fromRow === move.fromRow && k.fromCol === move.fromCol &&
                        k.toRow === move.toRow && k.toCol === move.toCol) {
                        // 第一槽权重高于第二槽
                        s += i === 0 ? 9000 : 8000;
                        break;
                    }
                }
            }

            // 4) 历史得分（仅非吃子）
            if (!move.captured && history) {
                s += Math.min(history[move.fromRow * 9 + move.fromCol][move.toRow * 9 + move.toCol], 8000);
            }

            move.score = s;
        }
    }

    // 评估棋盘状态（确定性的——这是 TT 生效的前提，绝不能引入随机性）
    // sideToMove: 当前要走棋的一方（true=白方/人，false=黑方/AI），用于正确计算将军加成
    // kingPosHints（可选）: { white, black } 缓存王位置，搜索路径透传给 isInCheck 跳过全盘找王
    function evaluateBoard(sideToMove, kingPosHints) {
        let score = 0;

        // 合并位置价值与子力评估为一次棋盘遍历（原先分两次遍历 90 格）
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = gameState.board[row][col];
                if (piece) {
                    const [type, isWhite] = piece;
                    const positionValue = positionValues[type][isWhite ? (9 - row) : row][col];
                    const material = pieceValues[type];
                    // 正值=对黑方(AI)有利；白方取负
                    score += isWhite ? -(positionValue + material) : (positionValue + material);
                }
            }
        }

        // 活动性评估（确定性的，每次都算，但权重低）
        score += evaluateMobility() * 0.3;

        // 检查对方是否被将军（加成）
        // score 为 AI（黑方）视角：白方被将军对 AI 有利(+20)，黑方被将军对 AI 不利(-20)
        const opponent = !sideToMove;
        const opponentHint = kingPosHints ? (opponent ? kingPosHints.white : kingPosHints.black) : null;
        if (isInCheck(opponent, opponentHint)) {
            score += opponent ? 20 : -20;
        }

        return score;
    }

    // 寻找最佳移动
    // 内部移动函数（不改UI）
    function makeAIMoveInternal(move) {
        // 保存原始状态
        const originalFromPiece = gameState.board[move.fromRow][move.fromCol];
        const originalToPiece = gameState.board[move.toRow][move.toCol];

        // 增量维护 Zobrist 键：本次走子要 XOR 的键之和（利用 XOR 自逆，undo 时再 XOR 同一个 delta 即可还原）
        //   - XOR 掉 from 格的走子键
        //   - XOR 掉 to 格被吃棋子的键（若有）
        //   - XOR 上 to 格的走子键
        //   - XOR 轮次键（轮到对手）
        let keyDelta = zobristTable[move.fromRow][move.fromCol][zobristPieceIndex(originalFromPiece)];
        if (originalToPiece) {
            keyDelta ^= zobristTable[move.toRow][move.toCol][zobristPieceIndex(originalToPiece)];
        }
        keyDelta ^= zobristTable[move.toRow][move.toCol][zobristPieceIndex(originalFromPiece)];
        keyDelta ^= zobristBlackToMove;

        // 增量维护王位置缓存：若走的是王，记住旧位置以便 undo 还原
        const isKingMove = originalFromPiece[0] === PIECE_TYPES.KING;
        const kingSideKey = originalFromPiece[1] ? 'white' : 'black';
        const oldKingPos = isKingMove ? { ...searchKingPos[kingSideKey] } : null;

        // 执行移动
        gameState.board[move.fromRow][move.fromCol] = null;
        gameState.board[move.toRow][move.toCol] = originalFromPiece;
        currentZobristKey ^= keyDelta;
        if (isKingMove) {
            searchKingPos[kingSideKey] = { row: move.toRow, col: move.toCol };
        }

        // 返回一个撤销函数：棋盘、键、王位置都通过闭包捕获的旧值还原
        return () => {
            // 恢复原始状态
            gameState.board[move.fromRow][move.fromCol] = originalFromPiece;
            gameState.board[move.toRow][move.toCol] = originalToPiece;
            currentZobristKey ^= keyDelta;
            if (isKingMove) {
                searchKingPos[kingSideKey] = oldKingPos;
            }
        };
    }

    function findBestMove() {
        const startTime = Date.now();
        const maxTime = 5000; // 限制搜索时间为5秒
        const maxDepth = gameState.aiDepths[gameState.aiDifficulty];

        // 初始化搜索上下文：Zobrist 键全量重算（搜索期间有效，结束即弃用）、启发式表
        currentZobristKey = computeZobristKey();
        ttClear(); // 清掉上一回合的 TT 条目（跨回合不复用，但同一次 findBestMove 内的迭代加深复用）
        initHeuristics();
        searchDeadline = startTime + maxTime;
        searchTimedOut = false;

        // 初始化王位置缓存（搜索开始时全盘找一次，后续增量维护）
        searchKingPos.white = null;
        searchKingPos.black = null;
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = gameState.board[row][col];
                if (piece && piece[0] === PIECE_TYPES.KING) {
                    if (piece[1]) searchKingPos.white = { row, col };
                    else searchKingPos.black = { row, col };
                }
            }
        }

        let depth = 1;
        let bestMove = null; // 上一次完整搜完的最佳走法（兜底）

        while (depth <= maxDepth) {
            let currentBestMove = null;
            let currentBestValue = -Infinity;

            try {
                // 根节点走法也用启发式排序（TT bestMove 优先，便于深层搜索尽早命中）
                // 根节点为 AI（黑方）走棋，传入黑方王位置 hint
                const moves = getAllPossibleMoves(gameState.currentPlayer, {
                    ply: 0,
                    ttBestMove: bestMove, // 以上一轮迭代的最佳走法作为 PV
                    killers: killerMoves[0],
                    history: historyTable,
                    isMaximizing: true
                }, searchKingPos.black);

                for (const move of moves) {
                    const undo = makeAIMoveInternal(move);
                    let value;
                    try {
                        // AI（黑方，最大化方）走完后轮到对手（白方，最小化方），故 isMaximizing=false
                        value = minimax(depth - 1, -Infinity, Infinity, false, 1);
                    } finally {
                        undo(); // 超时抛 SEARCH_TIMEOUT 时也保证棋盘/Zobrist 键还原
                    }

                    if (value > currentBestValue) {
                        currentBestValue = value;
                        currentBestMove = move;
                    }
                }

                // 本层完整搜完，更新 bestMove（跨迭代复用 TT 与 PV，不清表）
                bestMove = currentBestMove;
                depth++;
                statusText.textContent = `AI思考中...深度 ${depth - 1}`;
            } catch (e) {
                if (e === SEARCH_TIMEOUT) {
                    // 超时打断：保留上一层的完整结果，不采用本层半截结果
                    break;
                }
                throw e; // 真实异常重新抛出
            }
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
            const bestMove = findBestMove();
            
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
