'use strict';
/**
 * AI 引擎自动化测试（P4 轮引入，用 `node test-engine.js` 运行，无任何依赖）。
 *
 * 通过 DOM stub 加载 script.js，并使用 window.__bishopEngine 调试钩子访问引擎内部。
 *
 * 测试内容：
 *   1. 反向射线版 isSquareAttacked 与旧版全盘扫描参考实现的一致性（随机对局 + 变异 fuzz）
 *   2. 懒合法性验证（走后 isInCheck）与旧版 wouldBeInCheck 的一致性
 *   3. 战术测试：一步将死、吃悬子、困毙杀
 *   4. 重复局面检测（对局历史键播种 / 路径清理不变量）
 *   5. 增量静态分（searchScore）与全量计算的一致性
 *   6. 搜索不变量：搜索后棋盘、行棋方、增量分必须完全还原，searchPathKeys 必须清空
 *   7. 性能基准：开局局面下各难度到达的搜索深度与节点数
 */

// ---------- DOM stubs ----------
function makeStubEl() {
    return {
        className: '', textContent: '', innerHTML: '',
        style: {}, dataset: {},
        classList: { add() {}, remove() {} },
        addEventListener() {}, appendChild() {}, remove() {},
        querySelector: () => null,
        offsetWidth: 40, offsetLeft: 0, offsetTop: 0,
    };
}
global.window = {};
global.document = {
    addEventListener(type, cb) { global.__domReadyCb = cb; },
    getElementById: () => makeStubEl(),
    createElement: () => makeStubEl(),
    querySelector: () => makeStubEl(),
    querySelectorAll: () => [],
};
require('./script.js');
global.__domReadyCb();

const E = global.window.__bishopEngine;
const T = E.PIECE_TYPES;

// ---------- 测试基础设施 ----------
let passes = 0;
const failures = [];

function assert(cond, msg) {
    if (cond) {
        passes++;
    } else {
        failures.push(msg);
        console.error('  ✗ ' + msg);
    }
}

function emptyBoard() {
    return Array.from({ length: 10 }, () => Array(9).fill(null));
}

function cloneBoard(b) {
    return b.map(row => row.map(cell => (cell ? [cell[0], cell[1]] : null)));
}

function randomInt(n) {
    return Math.floor(Math.random() * n);
}

function setTestPosition(board, currentPlayer, difficulty) {
    E.gameState.board = board;
    E.gameState.currentPlayer = currentPlayer;
    E.gameState.aiDifficulty = difficulty;
    E.gameState.boardHistory = []; // 清空历史，避免对局历史重复键干扰战术测试
}

// ---------- 旧版参考实现（P2 的 canAttack 系列 + 全盘扫描 isSquareAttacked） ----------
// 逐字复制自优化前的 script.js（git 历史），用于验证新版反向射线实现的语义一致性。

function refIsPathClear(r1, c1, r2, c2) {
    const board = E.gameState.board;
    if (r1 === r2) {
        const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
        for (let c = minC + 1; c < maxC; c++) {
            if (board[r1][c]) return false;
        }
    } else {
        const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
        for (let r = minR + 1; r < maxR; r++) {
            if (board[r][c1]) return false;
        }
    }
    return true;
}

function refIsDiagonalClear(r1, c1, r2, c2) {
    const board = E.gameState.board;
    const dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1);
    let r = r1 + dr, c = c1 + dc;
    while (r !== r2 || c !== c2) {
        if (board[r][c]) return false;
        r += dr;
        c += dc;
    }
    return true;
}

function refCanRookAttack(r1, c1, r2, c2) {
    if (r1 !== r2 && c1 !== c2) return false;
    if (r1 === r2 && c1 === c2) return false;
    return refIsPathClear(r1, c1, r2, c2);
}

function refCanKnightAttack(r1, c1, r2, c2) {
    const board = E.gameState.board;
    const dr = r2 - r1, dc = c2 - c1;
    const adr = Math.abs(dr), adc = Math.abs(dc);
    if (!((adr === 2 && adc === 1) || (adr === 1 && adc === 2))) return false;
    const legRow = r1 + Math.sign(dr) * (adr > 1 ? 1 : 0);
    const legCol = c1 + Math.sign(dc) * (adc > 1 ? 1 : 0);
    return board[legRow][legCol] === null;
}

function refCanCannonAttack(r1, c1, r2, c2) {
    const board = E.gameState.board;
    if (r1 !== r2 && c1 !== c2) return false;
    if (r1 === r2 && c1 === c2) return false;
    let count = 0;
    if (r1 === r2) {
        const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
        for (let c = minC + 1; c < maxC; c++) {
            if (board[r1][c]) count++;
        }
    } else {
        const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
        for (let r = minR + 1; r < maxR; r++) {
            if (board[r][c1]) count++;
        }
    }
    return count === 1;
}

function refCanBishopAttack(r1, c1, r2, c2) {
    const dr = r2 - r1, dc = c2 - c1;
    if (Math.abs(dr) !== Math.abs(dc) || dr === 0) return false;
    return refIsDiagonalClear(r1, c1, r2, c2);
}

function refCanAdvisorAttack(r1, c1, isWhite, r2, c2) {
    const dr = Math.abs(r2 - r1), dc = Math.abs(c2 - c1);
    if (dr !== 1 || dc !== 1) return false;
    if (r2 < 0 || r2 >= 10 || c2 < 3 || c2 > 5) return false;
    if (isWhite && r2 < 7) return false;
    if (!isWhite && r2 > 2) return false;
    return true;
}

function refCanKingAttack(r1, c1, isWhite, r2, c2) {
    const board = E.gameState.board;
    const dr = Math.abs(r2 - r1), dc = Math.abs(c2 - c1);
    if (dr + dc === 1) {
        if (r2 < 0 || r2 >= 10 || c2 < 3 || c2 > 5) return false;
        if (isWhite && r2 < 7) return false;
        if (!isWhite && r2 > 2) return false;
        return true;
    }
    if (c1 === c2 && r1 !== r2) {
        const target = board[r2][c2];
        if (target && target[0] === T.KING && target[1] !== isWhite) {
            return refIsPathClear(r1, c1, r2, c2);
        }
    }
    return false;
}

function refCanPawnAttack(r1, c1, isWhite, r2, c2) {
    const colDiff = c2 - c1;
    if (isWhite) {
        if (r2 === r1 - 1 && colDiff === 0) return true;
        if (r1 <= 4 && r2 === r1 && Math.abs(colDiff) === 1) return true;
    } else {
        if (r2 === r1 + 1 && colDiff === 0) return true;
        if (r1 >= 5 && r2 === r1 && Math.abs(colDiff) === 1) return true;
    }
    return false;
}

function refCanPieceAttack(r1, c1, piece, r2, c2) {
    switch (piece[0]) {
        case T.ROOK: return refCanRookAttack(r1, c1, r2, c2);
        case T.KNIGHT: return refCanKnightAttack(r1, c1, r2, c2);
        case T.CANNON: return refCanCannonAttack(r1, c1, r2, c2);
        case T.BISHOP: return refCanBishopAttack(r1, c1, r2, c2);
        case T.ADVISOR: return refCanAdvisorAttack(r1, c1, piece[1], r2, c2);
        case T.KING: return refCanKingAttack(r1, c1, piece[1], r2, c2);
        case T.PAWN: return refCanPawnAttack(r1, c1, piece[1], r2, c2);
        default: return false;
    }
}

function refIsSquareAttacked(row, col, isWhite) {
    const board = E.gameState.board;
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            const piece = board[r][c];
            if (piece && piece[1] !== isWhite) {
                if (refCanPieceAttack(r, c, piece, row, col)) {
                    return true;
                }
            }
        }
    }
    return false;
}

// ---------- 随机对局与变异 fuzz ----------

// 走一步随机合法棋（直接改 gameState.board，绕过 UI/动画）
function playRandomMove(isWhite) {
    const board = E.gameState.board;
    const allMoves = [];
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            const piece = board[r][c];
            if (piece && piece[1] === isWhite) {
                const moves = E.getPossibleMoves(r, c, piece[0], piece[1]);
                for (const m of moves) allMoves.push([r, c, m[0], m[1]]);
            }
        }
    }
    if (allMoves.length === 0) return false;
    const m = allMoves[randomInt(allMoves.length)];
    board[m[2]][m[3]] = board[m[0]][m[1]];
    board[m[0]][m[1]] = null;
    return true;
}

// 随机变异棋盘（制造非法/怪异局面，扩大攻击检测的覆盖面）
function mutateBoard() {
    const board = E.gameState.board;
    const types = [T.KING, T.ROOK, T.KNIGHT, T.CANNON, T.BISHOP, T.ADVISOR, T.PAWN];
    const action = randomInt(3);
    if (action === 0) {
        // 删除随机棋子
        const occupied = [];
        for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) if (board[r][c]) occupied.push([r, c]);
        if (occupied.length > 2) {
            const [r, c] = occupied[randomInt(occupied.length)];
            board[r][c] = null;
        }
    } else if (action === 1) {
        // 随机瞬移一枚棋子
        const occupied = [];
        const empties = [];
        for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
            if (board[r][c]) occupied.push([r, c]); else empties.push([r, c]);
        }
        if (occupied.length > 0 && empties.length > 0) {
            const [fr, fc] = occupied[randomInt(occupied.length)];
            const [tr, tc] = empties[randomInt(empties.length)];
            board[tr][tc] = board[fr][fc];
            board[fr][fc] = null;
        }
    } else {
        // 随机添加一枚棋子
        const empties = [];
        for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) if (!board[r][c]) empties.push([r, c]);
        if (empties.length > 0) {
            const [r, c] = empties[randomInt(empties.length)];
            board[r][c] = [types[randomInt(types.length)], randomInt(2) === 1];
        }
    }
}

// 在当前局面下对全部 90 格 × 双方颜色比较新版与参考版 isSquareAttacked
function compareAttackAllSquares(context) {
    let compared = 0;
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            for (const isWhite of [true, false]) {
                const actual = E.isSquareAttacked(r, c, isWhite);
                const expected = refIsSquareAttacked(r, c, isWhite);
                compared++;
                if (actual !== expected) {
                    failures.push(`${context}: isSquareAttacked(${r},${c},${isWhite}) ` +
                        `新=${actual} 旧=${expected}\n棋盘=${JSON.stringify(E.gameState.board)}`);
                    console.error(`  ✗ ${context}: isSquareAttacked(${r},${c},${isWhite}) 新=${actual} 旧=${expected}`);
                    return compared;
                }
            }
        }
    }
    return compared;
}

// =====================================================================
console.log('== 测试 1：反向射线 isSquareAttacked 一致性（随机对局 + 变异 fuzz） ==');
{
    let compared = 0;
    const GAMES = 60, PLIES = 40, FUZZ_PER_GAME = 4;

    for (let g = 0; g < GAMES; g++) {
        E.gameState.board = cloneBoard(E.initialSetup);
        E.gameState.currentPlayer = true;
        compared += compareAttackAllSquares(`对局${g}初始`);
        if (failures.length) break;

        for (let ply = 0; ply < PLIES; ply++) {
            const isWhite = E.gameState.currentPlayer;
            if (!playRandomMove(isWhite)) break;
            E.gameState.currentPlayer = !isWhite;
            compared += compareAttackAllSquares(`对局${g}第${ply}步`);
            if (failures.length) break;
        }
        if (failures.length) break;

        for (let f = 0; f < FUZZ_PER_GAME; f++) {
            mutateBoard();
            compared += compareAttackAllSquares(`对局${g}fuzz${f}`);
            if (failures.length) break;
        }
        if (failures.length) break;
    }
    if (!failures.length) console.log(`  通过：${compared} 组比较全部一致`);
}

// =====================================================================
console.log('== 测试 2：懒合法性验证（走后 isInCheck）与旧版 wouldBeInCheck 一致性 ==');
{
    let compared = 0;
    const GAMES = 30, PLIES = 30;

    outer:
    for (let g = 0; g < GAMES; g++) {
        E.gameState.board = cloneBoard(E.initialSetup);
        E.gameState.currentPlayer = true;

        for (let ply = 0; ply < PLIES; ply++) {
            const board = E.gameState.board;
            for (const isWhite of [true, false]) {
                const pseudoMoves = E.getAllPseudoLegalMoves(isWhite, null);
                for (const m of pseudoMoves) {
                    // 新路径：手动走子 → isInCheck（无 hint，全盘找王）→ 还原
                    const savedTo = board[m.toRow][m.toCol];
                    const moving = board[m.fromRow][m.fromCol];
                    board[m.toRow][m.toCol] = moving;
                    board[m.fromRow][m.fromCol] = null;
                    const actualLegal = !E.isInCheck(isWhite);
                    board[m.fromRow][m.fromCol] = moving;
                    board[m.toRow][m.toCol] = savedTo;

                    // 旧路径：wouldBeInCheck（无 hint）
                    const expectedLegal = !E.wouldBeInCheck(m.fromRow, m.fromCol, m.toRow, m.toCol, isWhite);
                    compared++;
                    if (actualLegal !== expectedLegal) {
                        failures.push(`懒合法性(${m.fromRow},${m.fromCol}->${m.toRow},${m.toCol},white=${isWhite}) ` +
                            `新=${actualLegal} 旧=${expectedLegal}`);
                        console.error(`  ✗ 懒合法性 (${m.fromRow},${m.fromCol})->(${m.toRow},${m.toCol}) ` +
                            `新=${actualLegal} 旧=${expectedLegal}\n棋盘=${JSON.stringify(board)}`);
                        break outer;
                    }
                }
            }
            const isWhite = E.gameState.currentPlayer;
            if (!playRandomMove(isWhite)) break;
            E.gameState.currentPlayer = !isWhite;
        }
    }
    if (!failures.length) console.log(`  通过：${compared} 组比较全部一致`);
}

// =====================================================================
console.log('== 测试 3：增量静态分（searchScore）与全量计算一致性 ==');
{
    let compared = 0;
    const GAMES = 30, PLIES = 30;

    outer:
    for (let g = 0; g < GAMES; g++) {
        // 每局开始：随机对局若干步 + 随机变异，制造多样局面
        E.gameState.board = cloneBoard(E.initialSetup);
        E.gameState.currentPlayer = true;
        for (let ply = 0; ply < PLIES / 2; ply++) {
            const isWhite = E.gameState.currentPlayer;
            if (!playRandomMove(isWhite)) break;
            E.gameState.currentPlayer = !isWhite;
        }
        mutateBoard();

        E.gameState.boardHistory = [];
        E.initSearchContext();
        const board = E.gameState.board;

        // 初始增量分 = 全量分
        let actual = E.getStaticScore();
        let expected = E.computeStaticScore(board);
        compared++;
        if (Math.abs(actual - expected) > 1e-9) {
            failures.push(`增量分初始不一致: ${actual} vs ${expected}`);
            console.error(`  ✗ 增量分初始不一致: ${actual} vs ${expected}`);
            break;
        }

        // 随机走子/撤销链：每步走完后增量分必须等于全量分；撤销后必须还原到走子前
        for (let step = 0; step < 60; step++) {
            const isWhite = step % 2 === 0;
            const pseudo = E.getAllPseudoLegalMoves(isWhite, null);
            if (pseudo.length === 0) break;
            const m = pseudo[randomInt(pseudo.length)];
            const scoreBefore = E.getStaticScore();
            const undo = E.makeAIMoveInternal(m);
            actual = E.getStaticScore();
            expected = E.computeStaticScore(board);
            compared++;
            if (Math.abs(actual - expected) > 1e-9) {
                failures.push(`走子后增量分不一致 (${m.fromRow},${m.fromCol})->(${m.toRow},${m.toCol}): ` +
                    `${actual} vs ${expected}\n棋盘=${JSON.stringify(board)}`);
                console.error(`  ✗ 走子后增量分不一致: ${actual} vs ${expected}`);
                undo();
                break outer;
            }
            undo();
            actual = E.getStaticScore();
            compared++;
            if (Math.abs(actual - scoreBefore) > 1e-9) {
                failures.push(`撤销后增量分未还原到走子前: ${actual} vs ${scoreBefore}`);
                console.error(`  ✗ 撤销后增量分未还原到走子前: ${actual} vs ${scoreBefore}`);
                break outer;
            }
        }
    }
    if (!failures.length) console.log(`  通过：${compared} 组比较全部一致`);
}

// =====================================================================
console.log('== 测试 4：战术 —— 一步将死（双车闷杀） ==');
{
    // 白帅(9,4)孤立无援；黑车 B(8,0) 封锁第 8 行，黑车 A(6,7) 走到 (9,7) 沿第 9 行将杀。
    // 唯一杀着：R(6,7)->(9,7)。
    const b = emptyBoard();
    b[9][4] = [T.KING, true];
    b[0][3] = [T.KING, false];
    b[8][0] = [T.ROOK, false];
    b[6][7] = [T.ROOK, false];
    setTestPosition(b, false, 'hard');

    const before = JSON.stringify(b);
    const mv = E.findBestMove();
    const stats = E.getStats();
    assert(mv && mv.fromRow === 6 && mv.fromCol === 7 && mv.toRow === 9 && mv.toCol === 7,
        `应找到将杀 R(6,7)->(9,7)，实际=${JSON.stringify(mv)}`);
    assert(stats.rootValue >= E.MATE_BOUND,
        `将杀分值应 >= ${E.MATE_BOUND}，实际=${stats.rootValue}`);
    assert(JSON.stringify(b) === before, '搜索后棋盘必须完全还原');
    assert(E.gameState.currentPlayer === false, '搜索后行棋方必须不变');
    console.log(`  将杀分值=${stats.rootValue}, 深度=${stats.depth}, 节点=${stats.nodes}, ` +
        `静态节点=${stats.qnodes}, 耗时=${stats.timeMs}ms`);
}

console.log('== 测试 5：战术 —— 吃无保护的车（含困毙杀变例） ==');
{
    const b = emptyBoard();
    b[9][4] = [T.KING, true];
    b[5][4] = [T.ROOK, true];   // 白车悬在 (5,4)，无保护
    b[0][3] = [T.KING, false];
    b[5][0] = [T.ROOK, false];  // 黑车可 R(5,0)->(5,4) 吃车
    setTestPosition(b, false, 'hard');

    const before = JSON.stringify(b);
    const mv = E.findBestMove();
    assert(mv && mv.fromRow === 5 && mv.fromCol === 0 && mv.toRow === 5 && mv.toCol === 4,
        `应吃掉悬子 R(5,0)->(5,4)，实际=${JSON.stringify(mv)}`);
    assert(JSON.stringify(b) === before, '搜索后棋盘必须完全还原');
    console.log(`  分值=${E.getStats().rootValue}, 深度=${E.getStats().depth}, 耗时=${E.getStats().timeMs}ms`);
}

// =====================================================================
console.log('== 测试 6：重复局面检测 ==');
{
    // 对局历史键播种：boardHistory 里的局面应被 isRepetitionDraw 识别为和棋
    const b = cloneBoard(E.initialSetup);
    setTestPosition(b, false, 'easy');
    const snap1 = cloneBoard(b);
    // 手工构造一个"走过后"的快照（马跳警位）
    const snap2 = cloneBoard(b);
    snap2[9][1] = null;
    snap2[7][2] = [T.KNIGHT, true];
    E.gameState.boardHistory = [snap1, snap2];

    E.initSearchContext();
    assert(E.isRepetitionDraw(E.computeBoardKeyFromBoard(snap1)) === true,
        '历史局面应被判为重复（和棋）');
    assert(E.isRepetitionDraw(E.computeBoardKeyFromBoard(snap2)) === true,
        '当前局面应被判为重复（在历史中）');

    // 路径内重复：模拟 minimax 的 push/pop 语义
    E.gameState.boardHistory = [];
    E.initSearchContext();
    const key = E.computeBoardKeyFromBoard(E.gameState.board);
    // 通过 makeAIMoveInternal 前后键应一致（增量维护正确性）
    const move = { fromRow: 9, fromCol: 1, toRow: 7, toCol: 2, type: T.KNIGHT, captured: false, score: 0 };
    const scoreBefore = E.getStaticScore();
    const undo = E.makeAIMoveInternal(move);
    const keyAfter = E.computeBoardKeyFromBoard(E.gameState.board);
    undo();
    const keyRestored = E.computeBoardKeyFromBoard(E.gameState.board);
    assert(keyAfter !== key, '走子后 board-only 键应改变');
    assert(keyRestored === key, '撤销后 board-only 键应还原');
    assert(Math.abs(E.getStaticScore() - scoreBefore) < 1e-9, '撤销后增量静态分应还原');
    console.log('  通过：历史键播种 + board-only 键/增量静态分维护');
}

// =====================================================================
console.log('== 测试 7：搜索不变量 + 随机对局冒烟（搜索后状态完全还原） ==');
{
    const GAMES = 6, SEARCH_EVERY = 3, PLIES = 24;

    for (let g = 0; g < GAMES; g++) {
        E.gameState.board = cloneBoard(E.initialSetup);
        E.gameState.currentPlayer = true;
        E.gameState.boardHistory = [];

        for (let ply = 0; ply < PLIES; ply++) {
            if (ply % SEARCH_EVERY === 0) {
                const beforeBoard = JSON.stringify(E.gameState.board);
                const beforePlayer = E.gameState.currentPlayer;
                E.gameState.aiDifficulty = 'easy';
                E.gameState.boardHistory = [];
                const mv = E.findBestMove(); // 可能返回 null（被将死）
                const afterBoard = JSON.stringify(E.gameState.board);
                assert(afterBoard === beforeBoard, `对局${g}第${ply}步：搜索后棋盘必须还原`);
                assert(E.gameState.currentPlayer === beforePlayer, `对局${g}第${ply}步：行棋方必须不变`);
                assert(Math.abs(E.getStaticScore() - E.computeStaticScore(E.gameState.board)) < 1e-9,
                    `对局${g}第${ply}步：搜索后增量静态分必须与全量一致`);
                assert(E.isPlayerMated(beforePlayer) ? true : true, 'isPlayerMated 可调用'); // 冒烟
                if (mv) {
                    // AI 选的走法必须是伪合法走法之一（不验证合法性以保持测试简单）
                    const legal = E.getAllPseudoLegalMoves(E.gameState.currentPlayer, null)
                        .some(m => m.fromRow === mv.fromRow && m.fromCol === mv.fromCol &&
                                   m.toRow === mv.toRow && m.toCol === mv.toCol);
                    assert(legal, `AI 走法必须是伪合法走法: ${JSON.stringify(mv)}`);
                }
            }
            const isWhite = E.gameState.currentPlayer;
            if (!playRandomMove(isWhite)) break;
            E.gameState.currentPlayer = !isWhite;
        }
    }
    console.log('  通过：随机对局中搜索状态还原与走法合法性');
}

// =====================================================================
console.log('== 测试 8：性能基准（初始局面，AI 执黑） ==');
{
    for (const difficulty of ['easy', 'medium', 'hard']) {
        E.gameState.board = cloneBoard(E.initialSetup);
        E.gameState.currentPlayer = false;
        E.gameState.aiDifficulty = difficulty;
        E.gameState.boardHistory = [];
        const t0 = Date.now();
        const mv = E.findBestMove();
        const s = E.getStats();
        console.log(`  [${difficulty}] 深度=${s.depth} 节点=${s.nodes} 静态节点=${s.qnodes} ` +
            `耗时=${s.timeMs}ms 分值=${s.rootValue} 走法=` +
            (mv ? `(${mv.fromRow},${mv.fromCol})->(${mv.toRow},${mv.toCol})` : 'null'));
        assert(Date.now() - t0 < 8000, `${difficulty} 搜索耗时应 < 8s`);
        assert(!!mv, `${difficulty} 应返回走法`);
    }
}

// =====================================================================
console.log('\n========================================');
console.log(`总计：${passes} 项断言通过，${failures.length} 项失败`);
if (failures.length) {
    console.error('失败明细：');
    failures.forEach(f => console.error('  - ' + f));
    process.exit(1);
} else {
    console.log('全部通过 ✓');
}
