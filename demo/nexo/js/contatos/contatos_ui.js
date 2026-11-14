function _fmtCNPJ_ui(v) {
  return formatarCNPJ(v) || "-";
}

let _dragColIntel = null;
let _arrastandoIntel = false;

const ContatosUI = {

  _COLS_N1_ESC: [
    { key:'representanteDoc',  label:'CNPJ',          padrao:true,  fixo:false },
    { key:'representanteNome', label:'Representante',     padrao:true,  fixo:false },
    { key:'total',        label:'Total',          padrao:true,  fixo:true  },
    { key:'unidadeLider', label:'Unidade Líder',  padrao:true,  fixo:false },
    { key:'municipios',   label:'Municípios',     padrao:true,  fixo:false },
  ],
  _COLS_N1_EMP: [
    { key:'cnpj',         label:'CNPJ',          padrao:true,  fixo:true  },
    { key:'razaoSocial',  label:'Razão Social',  padrao:true,  fixo:false },
    { key:'status',       label:'Status',        padrao:true,  fixo:false },
    { key:'analista',      label:'Analista',       padrao:true,  fixo:false },
    { key:'municipio',    label:'Município',     padrao:false, fixo:false },
    { key:'cnae',         label:'CNAE',          padrao:false, fixo:false },
    { key:'unidade',      label:'Unidade',       padrao:false, fixo:false },
  ],
  _COLS_CRUZ: [
    { key:'vinculo',      label:'🔗',            padrao:true,  fixo:true  },
    { key:'cnpj',         label:'CNPJ',          padrao:true,  fixo:false },
    { key:'razaoSocial',  label:'Razão Social',  padrao:true,  fixo:false },
    { key:'status',       label:'Status',        padrao:true,  fixo:false },
    { key:'analista',      label:'Analista',       padrao:true,  fixo:false },
    { key:'unidade',      label:'Unidade',       padrao:true,  fixo:false },
    { key:'municipio',    label:'Município',     padrao:true,  fixo:false },
    { key:'cnae',         label:'CNAE',          padrao:false, fixo:false },
    { key:'nomeContato',  label:'Contato',       padrao:false, fixo:false },
  ],

  _ACC_N1_ESC: {
    representanteNome: c => c.representanteNome || '',
    representanteDoc:  c => c.representanteDoc  || '',
    total:        c => String(c.total),
    unidadeLider: c => c.unidadeLider || '',
    municipios:   c => c.municipios.join(', '),
  },
  _ACC_N1_EMP: {
    cnpj:        r => r.cnpjOriginal        || '',
    razaoSocial: r => r.empresa.RAZAOSOCIAL || '',
    status:      r => r.status              || '',
    analista:     r => r.analista             || '',
    municipio:   r => r.municipio           || '',
    cnae:        r => r.cnae                || '',
    unidade:     r => r.unidade             || '',
  },
  _ACC_CRUZ: {
    cnpj:        r => r.cnpjOriginal        || '',
    razaoSocial: r => r.empresa.RAZAOSOCIAL || '',
    status:      r => r.status              || '',
    analista:     r => r.analista             || '',
    unidade:     r => r.unidade             || '',
    municipio:   r => r.municipio           || '',
    cnae:        r => r.cnae                || '',
    nomeContato: r => r.nomeContato         || '',
  },

  _ativasN1Esc:  null,
  _ativasN1Emp:  null,
  _ativasCRUZ:  null,

  _sortN1Esc:    { key: null, asc: true },
  _filtroN1Esc:  {},
  _sortCRUZ:    { key: null, asc: true },
  _filtroCRUZ:  {},

  _n1Montado:    false,
  _cruzMontado: false,

  _pgN1:    { atual: 1, porPagina: 25 },
  _pgCRUZ: { atual: 1, porPagina: 25 },

  _agrupConfig: {
    telefone:    true,
    email:       true,
    contato:     false,
    cepEndereco: false,
    transitivo:  true,
  },

  _todosN1:            [],
  _cruzEscopo:        'local',
  _cruzAgrupado:      false,
  _buscaFragmento:     '',
  _buscaNomeContato:   '',
  _cnpjDetalheCRUZ:   null,

  _largurasN1:    {},
  _largurasCRUZ: {},

  _travarLargurasTabela(idTabela, idThead, mapaLarguras) {
    const tabela = document.getElementById(idTabela);
    const ths = document.querySelectorAll(`#${idThead} > tr:first-child > th`);
    ths.forEach((th) => {

      const chave = th.dataset.colKey;
      const w = th.offsetWidth;
      if (chave && w) {
        mapaLarguras[chave] = w;
        th.style.width = w + "px";
      }
    });
    if (tabela) tabela.style.tableLayout = "fixed";
  },

  _initColunas() {
    const d = defs => new Set(defs.filter(c => c.padrao).map(c => c.key));
    if (!this._ativasN1Esc) this._ativasN1Esc = d(this._COLS_N1_ESC);
    if (!this._ativasN1Emp) this._ativasN1Emp = d(this._COLS_N1_EMP);
    if (!this._ativasCRUZ) this._ativasCRUZ = d(this._COLS_CRUZ);
  },

  ativar() {
    this._initColunas();
    if (CruzEngine._pronto) { this._renderNivelAtivo(); return; }
    if (!CruzEngine._construindo) {
      this._mostrarProgresso();
      CruzEngine.construir(pct => this._atualizarProgresso(pct), () => this._renderNivelAtivo());
    }
  },

  aoMudarSubtoggle(targetId) {
    if (!CruzEngine._pronto) return;
    if (targetId === 'placeholder-central' && !this._n1Montado)    this._renderN1();
    if (targetId === 'placeholder-cruz1'  && !this._cruzMontado) this._renderCRUZ();
  },

  _renderNivelAtivo() {
    const ids = ['placeholder-central', 'placeholder-cruz1'];
    const v = ids.find(id => { const e = document.getElementById(id); return e && e.style.display !== 'none'; }) || ids[0];
    this.aoMudarSubtoggle(v);
  },

  _mostrarProgresso() {
    ['placeholder-central', 'placeholder-cruz1'].forEach(id => {
      const el = document.getElementById(id); if (!el) return;
      el.innerHTML = `<div style="text-align:center;padding:60px 20px;">
        <div class="cruz-spinner"></div>
        <p style="margin-top:16px;color:var(--text-muted);">Construindo índices de cruzamento…</p>
        <div class="cruz-progress-bar"><div class="cruz-progress-fill" id="cruz-bar-${id}" style="width:0%"></div></div>
      </div>`;
    });
  },

  _atualizarProgresso(pct) {
    document.querySelectorAll('[id^="cruz-bar-"]').forEach(el => { el.style.width = pct + '%'; });
  },

  _hexRgba(hex, a) {
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  },
  _selStyle() { return 'padding:6px 10px;border:1px solid var(--border-color);border-radius:5px;background:var(--bg-body);color:var(--text-main);font-size:0.85rem;cursor:pointer;'; },
  _notif(msg, t='info') { typeof _notificarUsuario==='function' ? _notificarUsuario(msg,t) : console.log(msg); },

  _unidadesDoCluster(items) {
    const set = new Set(items.map(r => r.unidade || 'SEM UNIDADE'));
    const lista = [...set];
    return lista.slice(0, 3).join(', ') + (lista.length > 3 ? ` +${lista.length - 3}` : '');
  },

  _filtrarOrdenar(items, sortState, filterState, accessors) {
    let res = items.filter(item => {
      for (const [key, val] of Object.entries(filterState)) {
        if (!val) continue;
        const raw = accessors[key]?.(item) || '';
        const v = raw.toUpperCase();

        if (key === 'cnpj' || key === 'representanteDoc') {
          if (!cnpjBuscaCasa(raw, val) && !v.includes(val)) return false;
        } else if (!v.includes(val)) {
          return false;
        }
      }
      return true;
    });
    if (sortState.key && accessors[sortState.key]) {
      const fn = accessors[sortState.key];
      res.sort((a, b) => {
        const va = fn(a), vb = fn(b);
        const num = !isNaN(va) && !isNaN(vb) && va!=='' && vb!=='';
        const c = num ? Number(va)-Number(vb) : va<vb ? -1 : va>vb ? 1 : 0;
        return sortState.asc ? c : -c;
      });
    }
    return res;
  },

  _cicloSort(sortState, key) {
    if (sortState.key !== key) { sortState.key = key; sortState.asc = true; }
    else if (sortState.asc)    { sortState.asc = false; }
    else                       { sortState.key = null; sortState.asc = true; }
  },

  _buildFilterTh(def, sortState, filterState, onSort, onFilter, colsArray, onReorder) {
    const th = document.createElement('th');
    th.dataset.colKey = def.key;
    th.style.minWidth = (def.key==='cnpj'||def.key==='representanteDoc') ? '120px'
                       : (def.key==='razaoSocial'||def.key==='representanteNome') ? '160px' : '90px';

    if (colsArray && onReorder && !def.fixo) {
      th.draggable = true;
      th.addEventListener('dragstart', e => {
        _dragColIntel = def.key;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => th.classList.add('drag-source'), 0);
      });
      th.addEventListener('dragend', () => {
        th.closest('tr')?.querySelectorAll('th').forEach(t => t.classList.remove('drag-source','drag-over'));
        _dragColIntel = null;
        setTimeout(() => { _arrastandoIntel = false; }, 0);
      });
      th.addEventListener('dragover', e => {
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        if (_dragColIntel && _dragColIntel !== def.key) {
          th.closest('tr')?.querySelectorAll('th').forEach(t => t.classList.remove('drag-over'));
          th.classList.add('drag-over');
        }
      });
      th.addEventListener('dragleave', e => { if (!th.contains(e.relatedTarget)) th.classList.remove('drag-over'); });
      th.addEventListener('drop', e => {
        e.preventDefault();
        if (!_dragColIntel || _dragColIntel === def.key) return;
        _arrastandoIntel = true;
        const iOrig = colsArray.findIndex(c => c.key === _dragColIntel);
        const iDest = colsArray.findIndex(c => c.key === def.key);
        if (iOrig === -1 || iDest === -1) return;
        const [movida] = colsArray.splice(iOrig, 1);
        colsArray.splice(iDest, 0, movida);
        onReorder();
      });
    }

    const content = document.createElement('div');
    content.className = 'th-content';
    const span = document.createElement('span'); span.textContent = def.label;
    const icon = document.createElement('i');
    icon.className = 'fas ' + (sortState.key===def.key ? (sortState.asc?'fa-sort-up':'fa-sort-down') : 'fa-sort');
    icon.dataset.sortKey = def.key;
    content.append(span, icon);
    content.addEventListener('click', () => { if (_arrastandoIntel) return; onSort(def.key); });

    const ativo = !!filterState[def.key];
    const divFiltro = document.createElement('div');
    divFiltro.className = 'col-filter-input col-filter-btn' + (ativo ? ' ativo' : '');
    divFiltro.style.marginTop = '4px';

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'filtro-inline';
    inp.placeholder = 'Filtrar...';
    inp.title = 'Digite para filtrar rapidamente';
    inp.value = ativo ? filterState[def.key] : '';
    inp.addEventListener('input', e => {
      const v = e.target.value.trim().toUpperCase();
      if (v) filterState[def.key] = v; else delete filterState[def.key];
      divFiltro.classList.toggle('ativo', !!v);
      onFilter();
    });
    inp.addEventListener('click', e => e.stopPropagation());

    const ico = document.createElement('i');
    ico.className = 'fas fa-filter filtro-icon';
    ico.title = 'Busca avançada';
    ico.addEventListener('click', e => {
      e.stopPropagation();
      _abrirDropdownTextoIntel(def.label, def.key, divFiltro, filterState, inp, onFilter);
    });

    divFiltro.append(inp, ico);
    th.append(content, divFiltro); return th;
  },

  _atualizarIconesSort(theadEl, sortState) {
    theadEl.querySelectorAll('[data-sort-key]').forEach(ic => {
      const k = ic.dataset.sortKey;
      ic.className = 'fas ' + (k===sortState.key ? (sortState.asc?'fa-sort-up':'fa-sort-down') : 'fa-sort');
    });
  },

  _lazyRender(container, allItems, renderItem, batchSize, scrollRoot, isTbody) {
    let offset = 0;
    const loadBatch = () => {
      allItems.slice(offset, offset+batchSize).forEach((item, i) => renderItem(item, offset+i, container));
      offset += batchSize;
      if (offset >= allItems.length) return;
      const sentinel = isTbody ? document.createElement('tr') : document.createElement('div');
      sentinel.className = '_cruz-lazy-sentinel';
      if (isTbody) { const td=document.createElement('td'); td.colSpan=99; td.style.padding='1px'; sentinel.appendChild(td); }
      container.appendChild(sentinel);
      const obs = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return; obs.disconnect(); sentinel.remove(); loadBatch();
      }, { root: scrollRoot||null, rootMargin:'150px' });
      obs.observe(sentinel);
    };
    loadBatch();
  },

  _buildPaginacao(estado, total, onMudar) {
    const OPCOES = [10, 25, 50, 100, 500, 0];
    const LABELS  = ['10','25','50','100','500','Todas'];
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 15px;border-top:1px solid var(--border-color);background:var(--bg-surface);';

    const sel = document.createElement('div');
    sel.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:0.82rem;';
    const lbl = document.createElement('span'); lbl.textContent = 'Exibir:'; sel.appendChild(lbl);
    OPCOES.forEach((n, idx) => {
      const btn = document.createElement('button');
      btn.textContent = LABELS[idx];
      const ativo = estado.porPagina === n;
      btn.style.cssText = `padding:2px 8px;border-radius:4px;border:1px solid var(--border-color);cursor:pointer;font-size:0.8rem;background:${ativo?'var(--color-primary)':'var(--bg-body)'};color:${ativo?'white':'var(--text-main)'};${ativo?'font-weight:700;':''}`;
      btn.onclick = () => { estado.porPagina = n; estado.atual = 1; onMudar(); };
      sel.appendChild(btn);
    });

    const pp  = estado.porPagina === 0 ? total : estado.porPagina;
    const de  = total === 0 ? 0 : (estado.atual - 1) * pp + 1;
    const ate = total === 0 ? 0 : Math.min(estado.atual * pp, total);
    const info = document.createElement('span');
    info.style.cssText = 'font-size:0.82rem;color:var(--text-muted);flex:1;text-align:center;white-space:nowrap;';
    info.textContent = total
      ? `Exibindo ${de.toLocaleString('pt-BR')} a ${ate.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} registros`
      : 'Nenhum registro';

    bar.append(sel, info);

    if (estado.porPagina > 0 && total > estado.porPagina) {
      const totalPags = Math.ceil(total / estado.porPagina);
      const nav = document.createElement('div');
      nav.style.cssText = 'display:flex;gap:3px;';
      const addB = (html, pag, disabled, ativo) => {
        const b = document.createElement('button');
        b.innerHTML = html; b.disabled = disabled;
        b.style.cssText = `padding:2px 8px;border-radius:4px;border:1px solid var(--border-color);cursor:${disabled?'default':'pointer'};font-size:0.8rem;background:${ativo?'var(--color-primary)':'var(--bg-body)'};color:${ativo?'white':'var(--text-main)'};opacity:${disabled?'0.4':'1'};`;
        if (!disabled && pag !== null) b.onclick = () => { estado.atual = pag; onMudar(); };
        nav.appendChild(b);
      };
      addB('«', 1, estado.atual===1, false);
      addB('‹', estado.atual-1, estado.atual===1, false);
      const s = Math.max(1, Math.min(estado.atual-2, totalPags-4));
      const e2 = Math.min(totalPags, s+4);
      for (let p = s; p <= e2; p++) addB(String(p), p, false, p===estado.atual);
      addB('›', estado.atual+1, estado.atual===totalPags, false);
      addB('»', totalPags, estado.atual===totalPags, false);
      bar.appendChild(nav);
    }
    return bar;
  },

  _gerenciarColunas(titulo, defs, ativas, onApply) {
    let modal = document.getElementById('_cruz-gcol-modal');
    if (!modal) {
      modal = document.createElement('div'); modal.id='_cruz-gcol-modal'; modal.className='modal-overlay'; modal.style.display='none';
      modal.innerHTML=`<div class="modal-content" style="max-width:640px;"><div class="modal-header"><h3 id="_cruz-gcol-titulo"></h3><button class="btn-icon" id="_cruz-gcol-close"><i class="fas fa-times"></i></button></div><p class="text-muted" style="margin-bottom:12px;">Colunas <b>*</b> são obrigatórias.</p><div class="column-toggle-list" id="_cruz-gcol-list"></div><div style="margin-top:20px;display:flex;justify-content:flex-end;"><button id="_cruz-gcol-apply" style="padding:10px 20px;background:var(--color-primary);color:white;border:none;border-radius:5px;cursor:pointer;font-weight:bold;">Aplicar e Fechar</button></div></div>`;
      document.body.appendChild(modal);
      document.getElementById('_cruz-gcol-close').onclick=()=>{ modal.style.display='none'; };
    }
    document.getElementById('_cruz-gcol-titulo').innerHTML=`<i class="fas fa-columns" style="color:var(--color-primary)"></i> ${titulo}`;
    const list=document.getElementById('_cruz-gcol-list'); list.innerHTML='';
    defs.forEach(def => {
      const on=ativas.has(def.key);
      const item=document.createElement('div'); item.className=`column-toggle-item${on?'':' disabled'}`;
      const chk=document.createElement('input'); chk.type='checkbox'; chk.checked=on; chk.disabled=!!def.fixo;
      const span=document.createElement('span'); span.textContent=def.fixo?`${def.label} *`:def.label;
      if (!def.fixo) item.addEventListener('click',e=>{ if(e.target!==chk)chk.checked=!chk.checked; item.classList.toggle('disabled',!chk.checked); });
      item.append(chk,span); list.appendChild(item);
    });
    const btnOld=document.getElementById('_cruz-gcol-apply');
    const btnNew=btnOld.cloneNode(true); btnOld.parentNode.replaceChild(btnNew,btnOld);
    btnNew.onclick=()=>{ const novas=new Set(defs.filter((_,i)=>list.querySelectorAll('input')[i].checked).map(d=>d.key)); modal.style.display='none'; onApply(novas); };
    modal.style.display='flex';
  },

  _renderN1() {
    this._n1Montado = true;
    const container = document.getElementById('placeholder-central'); if (!container) return;
    const clusters = CruzEngine.clustersRepresentante(7);
    this._todosN1 = clusters;
    if (!clusters.length) {
      container.innerHTML=`<div class="sync-card"><h3>Contato via Representante</h3><p class="text-muted">Nenhum representante com ≥ 7 empresas vinculadas nas bases carregadas.</p></div>`;
      return;
    }
    container.innerHTML=`
      <div class="table-card" style="background:var(--bg-surface);padding:0;border-radius:8px;overflow:hidden;">
        <div class="table-header-highlight" style="border-radius:8px 8px 0 0;margin-bottom:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div style="flex:1;min-width:0;"><h3 style="margin:0;"><i class="fas fa-building"></i> Contato via Representante — ${clusters.length} representante(s)</h3><small>Representantes com ≥ 7 empresas vinculadas · [+] para ver as empresas</small></div>
            <button id="btn-gcol-n1-esc" style="background:rgba(255,255,255,0.18);color:white;border:1px solid rgba(255,255,255,0.35);padding:5px 10px;border-radius:4px;cursor:pointer;font-size:0.8rem;white-space:nowrap;flex-shrink:0;"><i class="fas fa-columns"></i> Representante</button>
            <button id="btn-gcol-n1-emp" style="background:rgba(255,255,255,0.18);color:white;border:1px solid rgba(255,255,255,0.35);padding:5px 10px;border-radius:4px;cursor:pointer;font-size:0.8rem;white-space:nowrap;flex-shrink:0;"><i class="fas fa-list"></i> Empresas</button>
          </div>
        </div>
        <div style="overflow:auto;max-height:calc(100vh - 310px);"><table class="preview-table v-lines cruz-grid" id="grid-n1" style="width:100%;"><thead id="n1-thead"></thead><tbody id="tbody-n1"></tbody></table></div>
      </div>`;
    this._buildN1Thead();
    this._populateN1Tbody();
    this._travarLargurasTabela('grid-n1', 'n1-thead', this._largurasN1);
    document.getElementById('btn-gcol-n1-esc').onclick=()=>this._gerenciarColunas('Colunas do Representante',this._COLS_N1_ESC,this._ativasN1Esc,novas=>{
      this._ativasN1Esc=novas;
      this._largurasN1={};
      const t=document.getElementById('grid-n1'); if (t) t.style.tableLayout='';
      this._buildN1Thead();
      this._populateN1Tbody();
      this._travarLargurasTabela('grid-n1', 'n1-thead', this._largurasN1);
    });
    document.getElementById('btn-gcol-n1-emp').onclick=()=>this._gerenciarColunas('Colunas das Empresas',this._COLS_N1_EMP,this._ativasN1Emp,novas=>{ this._ativasN1Emp=novas; this._populateN1Tbody(); });
  },

  _buildN1Thead() {
    const thead=document.getElementById('n1-thead'); if (!thead) return;
    const tr=document.createElement('tr');
    const thEx=document.createElement('th'); thEx.style.width='36px'; tr.appendChild(thEx);
    const onSort=key=>{
      this._cicloSort(this._sortN1Esc,key);
      this._pgN1.atual=1;
      this._atualizarIconesSort(thead,this._sortN1Esc);
      this._populateN1Tbody();
    };
    const onFilter=()=>{ this._pgN1.atual=1; this._populateN1Tbody(); };
    const onReorder=()=>{ this._buildN1Thead(); this._populateN1Tbody(); };
    this._COLS_N1_ESC.forEach(def=>{
      if(!this._ativasN1Esc.has(def.key))return;
      const th=this._buildFilterTh(def,this._sortN1Esc,this._filtroN1Esc,onSort,onFilter,this._COLS_N1_ESC,onReorder);

      if (this._largurasN1[def.key]) th.style.width = this._largurasN1[def.key] + "px";
      tr.appendChild(th);
    });
    const thA=document.createElement('th'); thA.textContent='Ação'; thA.style.minWidth='80px'; tr.appendChild(thA);
    thead.innerHTML=''; thead.appendChild(tr);
  },

  _populateN1Tbody() {
    const tbody=document.getElementById('tbody-n1'); if(!tbody) return;
    tbody.innerHTML='';

    document.getElementById('_pg-n1-bar')?.remove();

    const visible=this._filtrarOrdenar(this._todosN1,this._sortN1Esc,this._filtroN1Esc,this._ACC_N1_ESC);

    if (!visible.length) {
      const tr=document.createElement('tr'); const td=document.createElement('td'); td.colSpan=99; td.style.cssText='text-align:center;padding:24px;color:var(--text-muted);'; td.textContent='Nenhum representante para os filtros aplicados.'; tr.appendChild(td); tbody.appendChild(tr);
    } else {
      const total=visible.length;
      const pp=this._pgN1.porPagina===0?total:this._pgN1.porPagina;
      const inicio=(this._pgN1.atual-1)*pp;
      const pagina=this._pgN1.porPagina===0?visible:visible.slice(inicio,inicio+pp);
      pagina.forEach((cluster,i)=>this._appendN1Row(tbody,cluster,inicio+i));
    }

    const card=tbody.closest('.table-card,div[style*="border-radius"]');
    if (card) {
      const pgBar=this._buildPaginacao(this._pgN1,visible.length,()=>this._populateN1Tbody());
      pgBar.id='_pg-n1-bar';
      card.appendChild(pgBar);
    }
  },

  _appendN1Row(tbody, cluster, idx) {
    const tr=document.createElement('tr'); tr.dataset.idx=String(idx); tr.className='cruz-cluster-header';
    const tdEx=document.createElement('td');
    const btn=document.createElement('button'); btn.className='btn-expand-n1'; btn.textContent='+';
    btn.onclick=()=>this._toggleN1(tbody,cluster,idx,btn);
    tdEx.appendChild(btn); tr.appendChild(tdEx);
    this._COLS_N1_ESC.forEach(def=>{
      if(!this._ativasN1Esc.has(def.key))return;
      const td=document.createElement('td');
      switch(def.key){
        case 'representanteNome': td.style.cssText='white-space:normal;word-break:break-word;'; const nm=document.createElement('strong'); nm.textContent=cluster.representanteNome||'Nome não informado'; td.appendChild(nm); break;
        case 'representanteDoc':  td.style.cssText='font-family:monospace;font-size:0.81rem;white-space:normal;word-break:break-all;color:var(--text-muted);'; td.textContent=_fmtCNPJ_ui(cluster.representanteDoc); break;
        case 'total':        const b=document.createElement('span'); b.className='cruz-count-badge'; b.textContent=cluster.total; td.appendChild(b); break;
        case 'unidadeLider': const ba=document.createElement('span'); ba.className='cruz-unidade-badge'; ba.textContent=cluster.unidadeLider; td.appendChild(ba); break;
        case 'municipios':   td.style.cssText='font-size:0.83rem;white-space:normal;word-break:break-word;'; const m=cluster.municipios; td.textContent=m.slice(0,3).join(', ')+(m.length>3?` +${m.length-3}`:''); break;
      }
      tr.appendChild(td);
    });
    const tdA=document.createElement('td');
    const btnP=document.createElement('button'); btnP.className='btn-cruz-action'; btnP.innerHTML='<i class="fas fa-file-pdf"></i> Cartas';
    btnP.onclick=e=>{ e.stopPropagation(); this._cartasN1(cluster); };
    tdA.appendChild(btnP); tr.appendChild(tdA); tbody.appendChild(tr);
  },

  _toggleN1(tbody, cluster, idx, btn) {
    const tag=`fn1-${idx}`;
    const existing=tbody.querySelector(`[data-fn1="${tag}"]`);
    if (existing) { existing.remove(); btn.textContent='+'; return; }
    btn.textContent='−';
    const containerRow=document.createElement('tr'); containerRow.dataset.fn1=tag; containerRow.className='cruz-filhas-container';
    const td=document.createElement('td'); td.colSpan=99; td.style.cssText='padding:0;border-left:4px solid var(--color-primary);background:rgba(79, 70, 229,0.02);';
    const scrollWrap=document.createElement('div'); scrollWrap.style.cssText='overflow-x:auto;';
    const subTable=document.createElement('table'); subTable.className='preview-table v-lines cruz-grid'; subTable.style.cssText='width:100%;margin:0;border-top:1px solid rgba(79, 70, 229,0.25);';
    const subThead=document.createElement('thead'), subTbody=document.createElement('tbody');
    const sortEmp={key:null,asc:true}, filtroEmp={};
    const rebuildSubThead=()=>{
      const tr=document.createElement('tr');
      const onSort=key=>{ this._cicloSort(sortEmp,key); this._atualizarIconesSort(subThead,sortEmp); rebuildSubTbody(); };
      const onReorder=()=>{ rebuildSubThead(); rebuildSubTbody(); };
      this._COLS_N1_EMP.forEach(def=>{ if(!this._ativasN1Emp.has(def.key))return; tr.appendChild(this._buildFilterTh(def,sortEmp,filtroEmp,onSort,rebuildSubTbody,this._COLS_N1_EMP,onReorder)); });
      subThead.innerHTML=''; subThead.appendChild(tr);
    };
    const rebuildSubTbody=()=>{
      subTbody.innerHTML='';
      const visible=this._filtrarOrdenar(cluster.registros,sortEmp,filtroEmp,this._ACC_N1_EMP);
      if (!visible.length) { const tr=document.createElement('tr'); const td=document.createElement('td'); td.colSpan=99; td.style.cssText='text-align:center;padding:16px;color:var(--text-muted);font-style:italic;'; td.textContent='Nenhuma empresa para o filtro.'; tr.appendChild(td); subTbody.appendChild(tr); return; }
      this._lazyRender(subTbody,visible,(reg)=>{
        const tr=document.createElement('tr');
        this._COLS_N1_EMP.forEach(def=>{
          if(!this._ativasN1Emp.has(def.key))return;
          const cell=document.createElement('td'); cell.style.cssText='font-size:0.84rem;color:var(--text-main);';
          switch(def.key){
            case 'cnpj':        cell.style.fontFamily='monospace'; cell.textContent=_fmtCNPJ_ui(reg.cnpjOriginal); break;
            case 'razaoSocial': cell.textContent=reg.empresa.RAZAOSOCIAL||'-'; break;
            case 'status':      cell.textContent=reg.status||'-'; break;
            case 'analista':     cell.className='text-left'; cell.textContent=reg.analista||'-'; break;
            case 'municipio':   cell.textContent=reg.municipio||'-'; break;
            case 'cnae':        cell.textContent=reg.cnae||'-'; break;
            case 'unidade':     cell.className='text-left'; cell.textContent=reg.unidade||'-'; break;
          }
          tr.appendChild(cell);
        });
        subTbody.appendChild(tr);
      },40,scrollWrap,true);
    };
    rebuildSubThead(); rebuildSubTbody();
    subTable.append(subThead,subTbody); scrollWrap.appendChild(subTable); td.appendChild(scrollWrap); containerRow.appendChild(td);
    tbody.querySelector(`[data-idx="${idx}"]`).insertAdjacentElement('afterend',containerRow);
  },

  _cartasN1(cluster) {
    const locais=new Set(typeof dbGlobal!=='undefined'?dbGlobal.map(e=>e.CNPJ):[]);
    const cnpjs=cluster.registros.filter(r=>locais.has(r.cnpjOriginal)).map(r=>r.cnpjOriginal);
    if (!cnpjs.length){this._notif('Nenhuma empresa local neste cluster.','info');return;}
    if (typeof selectedCNPJs!=='undefined'){selectedCNPJs.clear();cnpjs.forEach(c=>selectedCNPJs.add(c));}
    typeof openPdfModal==='function'&&openPdfModal();
  },

  _renderCRUZ() {
    this._cruzMontado = true;
    const container = document.getElementById('placeholder-cruz1'); if (!container) return;

    const total = CruzEngine.indices.registros.size;
    const locais = CruzEngine.cnpjsLocais.size;

    container.innerHTML = `
      <div class="table-card" style="background:var(--bg-surface);padding:0;border-radius:8px;overflow:hidden;">
        <div class="table-header-highlight" style="border-radius:8px 8px 0 0;margin-bottom:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div style="flex:1;min-width:0;">
              <h3 style="margin:0;"><i class="fas fa-search"></i> Busca de vínculos</h3>
              <small id="cruz-subtitulo">Clique em 🔗 para ver vínculos · 👤 = mesmo contato · ⚡ = forte (contato + telefone)</small>
            </div>
            <!-- Colunas (mais à esquerda) -->
            <button id="btn-gcol-cruz" style="background:rgba(255,255,255,0.18);color:white;border:1px solid rgba(255,255,255,0.35);padding:5px 10px;border-radius:4px;cursor:pointer;font-size:0.8rem;white-space:nowrap;flex-shrink:0;">
              <i class="fas fa-columns"></i> Colunas
            </button>
            <!-- Escopo toggle -->
            <div id="cruz-escopo-btns" style="display:flex;gap:4px;flex-shrink:0;">
              <button id="btn-escopo-local" class="_btn-escopo _btn-escopo-ativo" title="Exibir apenas empresas da minha unidade">
                <i class="fas fa-map-marker-alt"></i> Minha Unidade
              </button>
              <button id="btn-escopo-rede" class="_btn-escopo" title="Exibir toda a base da rede">
                <i class="fas fa-globe"></i> Rede
              </button>
            </div>
            <!-- Agrupar + engrenagem (agrupado = ativo) -->
            <div style="display:flex;gap:0;flex-shrink:0;">
              <button id="btn-cruz-agrupar" title="Agrupar empresas por identificador em comum" style="background:rgba(255,255,255,0.12);color:white;border:1px solid rgba(255,255,255,0.3);padding:5px 10px;border-radius:4px 0 0 4px;cursor:pointer;font-size:0.8rem;white-space:nowrap;">
                <i class="fas fa-layer-group"></i> Agrupar por Vínculo
              </button>
              <button id="btn-agrupar-config" title="Configurar agrupamento" style="display:none;background:rgba(255,255,255,0.22);color:white;border:1px solid rgba(255,255,255,0.3);border-left:1px solid rgba(255,255,255,0.15);padding:5px 9px;border-radius:0 4px 4px 0;cursor:pointer;font-size:0.85rem;">
                ⚙️
              </button>
            </div>
          </div>
        </div>

        <!-- Barra de busca -->
        <div style="padding:10px 15px;background:var(--bg-surface);border-bottom:1px solid var(--border-color);display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <input type="text" id="cruz-busca-frag" placeholder="🔍 Buscar fragmento — CNPJ, razão, e-mail, telefone, analista…"
            style="flex:2;min-width:200px;padding:7px 12px;border:1px solid var(--border-color);border-radius:5px;background:var(--bg-body);color:var(--text-main);font-size:0.9rem;">
          <input type="text" id="cruz-busca-contato" placeholder="👤 Nome do contato (ex: João Silva)…"
            style="flex:1;min-width:160px;padding:7px 12px;border:1px solid var(--border-color);border-radius:5px;background:var(--bg-body);color:var(--text-main);font-size:0.9rem;">
          <label style="display:flex;align-items:center;gap:6px;font-size:0.88rem;cursor:pointer;white-space:nowrap;">
            <input type="checkbox" id="cruz-soVinculos"> Só com vínculos
          </label>
        </div>

        <!-- Grid ou clusters -->
        <div id="cruz-corpo">
          <div style="overflow:auto;max-height:calc(100vh - 310px);">
            <table class="preview-table v-lines cruz-grid" id="grid-cruz" style="width:100%;">
              <thead id="cruz-thead"></thead>
              <tbody id="tbody-cruz"></tbody>
            </table>
          </div>
        </div>
      </div>`;

    this._buildCRUZThead();
    this._populateCRUZ();
    this._travarLargurasTabela('grid-cruz', 'cruz-thead', this._largurasCRUZ);

    document.getElementById('btn-escopo-local').onclick=()=>this._setEscopo('local');
    document.getElementById('btn-escopo-rede').onclick=()=>this._setEscopo('rede');

    document.getElementById('btn-cruz-agrupar').onclick=()=>{
      this._cruzAgrupado = !this._cruzAgrupado;
      const btn    = document.getElementById('btn-cruz-agrupar');
      const btnCfg = document.getElementById('btn-agrupar-config');
      btn.style.background    = this._cruzAgrupado ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)';
      btn.style.fontWeight    = this._cruzAgrupado ? '700' : '';
      btn.innerHTML = this._cruzAgrupado
        ? '<i class="fas fa-table"></i> Ver Tabela Plana'
        : '<i class="fas fa-layer-group"></i> Agrupar por Vínculo';
      if (btnCfg) btnCfg.style.display = this._cruzAgrupado ? 'inline-block' : 'none';
      this._populateCRUZ();
    };

    document.getElementById('btn-agrupar-config').onclick=()=>this._abrirConfigAgrupar();

    document.getElementById('btn-gcol-cruz').onclick=()=>{
      this._gerenciarColunas('Colunas do CRUZ',this._COLS_CRUZ,this._ativasCRUZ,novas=>{
        this._ativasCRUZ=novas; this._sortCRUZ={key:null,asc:true}; this._filtroCRUZ={};
        this._largurasCRUZ={};
        const t=document.getElementById('grid-cruz'); if (t) t.style.tableLayout='';
        this._buildCRUZThead(); this._populateCRUZ();
        this._travarLargurasTabela('grid-cruz', 'cruz-thead', this._largurasCRUZ);
      });
    };

    let tmrF, tmrC;
    document.getElementById('cruz-busca-frag').addEventListener('input',e=>{ clearTimeout(tmrF); tmrF=setTimeout(()=>{ this._buscaFragmento=e.target.value; this._pgCRUZ.atual=1; this._populateCRUZ(); },300); });
    document.getElementById('cruz-busca-contato').addEventListener('input',e=>{ clearTimeout(tmrC); tmrC=setTimeout(()=>{ this._buscaNomeContato=e.target.value; this._pgCRUZ.atual=1; this._populateCRUZ(); },300); });
    document.getElementById('cruz-soVinculos').addEventListener('change',()=>{ this._pgCRUZ.atual=1; this._populateCRUZ(); });
  },

  _setEscopo(escopo) {
    this._cruzEscopo = escopo;
    document.getElementById('btn-escopo-local')?.classList.toggle('_btn-escopo-ativo', escopo==='local');
    document.getElementById('btn-escopo-rede')?.classList.toggle('_btn-escopo-ativo', escopo==='rede');
    this._sortCRUZ={key:null,asc:true}; this._filtroCRUZ={};
    this._pgCRUZ.atual=1;
    this._buildCRUZThead(); this._populateCRUZ();
  },

  _buildCRUZThead() {
    const thead=document.getElementById('cruz-thead'); if(!thead) return;
    const tr=document.createElement('tr');
    const onSort=key=>{
      this._cicloSort(this._sortCRUZ,key);
      this._pgCRUZ.atual=1;
      this._atualizarIconesSort(thead,this._sortCRUZ);
      this._populateCRUZ();
    };
    const onFilter=()=>{ this._pgCRUZ.atual=1; this._populateCRUZ(); };
    const onReorder=()=>{ this._buildCRUZThead(); this._populateCRUZ(); };
    this._COLS_CRUZ.forEach(def=>{
      if(!this._ativasCRUZ.has(def.key))return;
      if (def.key==='vinculo') {
        const th=document.createElement('th'); th.style.width='68px'; th.title='Vínculo detectado (🔗 fone/e-mail · 👤 contato · ⚡ forte) — 🖨️ imprime o detalhamento em PDF'; th.textContent='🔗'; tr.appendChild(th);
      } else {
        const th=this._buildFilterTh(def,this._sortCRUZ,this._filtroCRUZ,onSort,onFilter,this._COLS_CRUZ,onReorder);

        if (this._largurasCRUZ[def.key]) th.style.width = this._largurasCRUZ[def.key] + "px";
        tr.appendChild(th);
      }
    });
    thead.innerHTML=''; thead.appendChild(tr);
  },

  _linhasCRUZ() {
    let rows = [...CruzEngine.indices.registros.values()];

    if (this._cruzEscopo === 'local') rows = rows.filter(r => CruzEngine.cnpjsLocais.has(r.cnpj));

    if (this._buscaFragmento.trim().length >= 2) {
      const frag = CruzEngine.buscarFragmento(this._buscaFragmento.trim());
      rows = rows.filter(r => frag.has(r.cnpj));
    }

    if (this._buscaNomeContato.trim().length >= 2) {
      const cont = CruzEngine.buscarContato(this._buscaNomeContato.trim());
      rows = rows.filter(r => cont.has(r.cnpj));
    }

    if (document.getElementById('cruz-soVinculos')?.checked) {
      rows = rows.filter(r => CruzEngine.temVinculo(r.cnpjOriginal).vinculo);
    }

    const filtroSemVinculo = Object.fromEntries(Object.entries(this._filtroCRUZ).filter(([k])=>k!=='vinculo'));
    return this._filtrarOrdenar(rows, this._sortCRUZ, filtroSemVinculo, this._ACC_CRUZ);
  },

  _populateCRUZ() {
    if (this._cruzAgrupado) { this._renderClustersCRUZ(); return; }

    const corpo = document.getElementById('cruz-corpo'); if (!corpo) return;

    if (!document.getElementById('tbody-cruz')) {
      corpo.innerHTML=`<div style="overflow-x:auto;"><table class="preview-table v-lines cruz-grid" id="grid-cruz" style="width:100%;"><thead id="cruz-thead"></thead><tbody id="tbody-cruz"></tbody></table></div>`;
      this._buildCRUZThead();
    }

    document.getElementById('_pg-cruz-bar')?.remove();
    document.getElementById('_cruz2-detalhe')?.remove();
    this._cnpjDetalheCRUZ = null;
    const tbody=document.getElementById('tbody-cruz'); if(!tbody)return;
    tbody.innerHTML='';

    const rows = this._linhasCRUZ();
    const cols = this._COLS_CRUZ.filter(d=>this._ativasCRUZ.has(d.key));

    const comV = rows.filter(r=>CruzEngine.temVinculo(r.cnpjOriginal).vinculo).length;
    const sub = document.getElementById('cruz-subtitulo');
    if (sub) sub.textContent = `${rows.length} empresa(s) exibidas · ${comV} com vínculos detectados · 🔗 fone/e-mail · 👤 contato · ⚡ forte`;

    if (!rows.length) {
      const tr=document.createElement('tr'); const td=document.createElement('td'); td.colSpan=99; td.style.cssText='text-align:center;padding:24px;color:var(--text-muted);'; td.textContent='Nenhum resultado.'; tr.appendChild(td); tbody.appendChild(tr);
    } else {

      const total=rows.length;
      const pp=this._pgCRUZ.porPagina===0?total:this._pgCRUZ.porPagina;
      const inicio=(this._pgCRUZ.atual-1)*pp;
      const pagina=this._pgCRUZ.porPagina===0?rows:rows.slice(inicio,inicio+pp);

      pagina.forEach(reg=>{
        const info=CruzEngine.temVinculo(reg.cnpjOriginal);
        const tr=document.createElement('tr'); tr.dataset.cnpj=reg.cnpjOriginal;
        cols.forEach(def=>{
          const td=document.createElement('td'); td.style.color='var(--text-main)';
          switch(def.key){
            case 'vinculo':
              td.style.textAlign='center';
              td.style.whiteSpace='nowrap';
              if (info.vinculo) {
                const ic=document.createElement('i');
                if (info.forca==='forte') { ic.className='fas fa-bolt'; ic.style.color='#ef4444'; ic.title='⚡ FORTE: mesmo contato + mesmo telefone'; }
                else if (info.forca==='normal') { ic.className='fas fa-link cruz-badge-link'; ic.title=`Compartilha ${info.motivos.join(' e ')} com ${info.count} outra(s) — clique para detalhes`; }
                else { ic.className='fas fa-user-friends'; ic.style.color='#f59e0b'; ic.title='Mesmo nome de contato em outra(s) empresa(s) — clique para detalhes'; }
                ic.style.cursor='pointer';
                ic.onclick=e=>{ e.stopPropagation(); this._toggleVinculoDetalhe(reg.cnpjOriginal,tr); };
                td.appendChild(ic);

                const icPdf=document.createElement('i');
                icPdf.className='fas fa-print';
                icPdf.style.cssText='margin-left:6px;cursor:pointer;color:var(--text-muted);';
                icPdf.title='Gerar PDF com o detalhamento dos vínculos desta empresa';
                icPdf.onclick=e=>{ e.stopPropagation(); this._gerarPdfVinculos(reg.cnpjOriginal); };
                td.appendChild(icPdf);
              }
              break;
            case 'cnpj':        td.style.fontFamily='monospace'; td.style.fontSize='0.82rem'; td.textContent=_fmtCNPJ_ui(reg.cnpjOriginal); break;
            case 'razaoSocial': td.textContent=reg.empresa.RAZAOSOCIAL||'-'; break;
            case 'status':      td.textContent=reg.status||'-'; td.style.fontSize='0.85rem'; break;
            case 'analista':     td.className='text-left'; td.textContent=reg.analista||'-'; td.style.fontSize='0.85rem'; break;
            case 'unidade':     td.textContent=reg.unidade||'-'; td.style.fontSize='0.85rem'; break;
            case 'municipio':   td.textContent=reg.municipio||'-'; td.style.fontSize='0.85rem'; break;
            case 'cnae':        td.textContent=reg.cnae||'-'; td.style.fontSize='0.85rem'; break;
            case 'nomeContato': td.className='text-left'; td.textContent=reg.nomeContato||'-'; td.style.fontSize='0.85rem'; break;
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }

    const pgBar=this._buildPaginacao(this._pgCRUZ,rows.length,()=>this._populateCRUZ());
    pgBar.id='_pg-cruz-bar';
    corpo.appendChild(pgBar);
  },

  _calcularVinculos(cnpjOrig) {
    const cn=CruzNorm.cnpj(cnpjOrig);
    const reg=cn?CruzEngine.indices.registros.get(cn):null;
    if (!reg) return null;

    const vinculos=[];
    for (const tel of reg.telefones) {
      const s=CruzEngine.indices.porTelefone.get(tel); if(!s||s.size<=1)continue;
      const outros=[...s].filter(c=>c!==cn).map(c=>CruzEngine.indices.registros.get(c)).filter(Boolean);
      if (outros.length) vinculos.push({tipo:'📞 Telefone',chave:tel,outros,forte:false});
    }
    for (const ch of reg.emailsChave) {
      const s=CruzEngine.indices.porEmail.get(ch); if(!s||s.size<=1)continue;
      const outros=[...s].filter(c=>c!==cn).map(c=>CruzEngine.indices.registros.get(c)).filter(Boolean);
      if (outros.length) vinculos.push({tipo:ch.startsWith('@')?'📧 Domínio e-mail':'📧 E-mail exato',chave:ch,outros,forte:false});
    }

    if (reg.nomeContato) {
      const s=CruzEngine.indices.porNomeContato.get(reg.nomeContato); if(s&&s.size>1){
        const outros=[...s].filter(c=>c!==cn).map(c=>CruzEngine.indices.registros.get(c)).filter(Boolean);
        if (outros.length) {
          const fortePares=outros.filter(r2=>CruzEngine.ehLigacaoForte(cn,r2.cnpj));
          vinculos.push({tipo:'👤 Nome de Contato',chave:reg.nomeContato,outros,fortePares});
        }
      }
    }
    return { reg, vinculos };
  },

  _PDF_COR_PRIMARIA: [2, 132, 199],
  _PDF_COR_FORTE:    [239, 68, 68],
  _PDF_COR_TEXTO:    [30, 41, 59],
  _PDF_COR_MUTED:    [100, 116, 139],
  _PDF_COR_FAIXA:    [241, 245, 249],

  _pdfCabecalho(doc, titulo, subtitulo) {
    const largura = doc.internal.pageSize.getWidth();
    const alturaFaixa = subtitulo ? 27 : 20;

    doc.setFillColor(...this._PDF_COR_PRIMARIA);
    doc.rect(0, 0, largura, alturaFaixa, 'F');

    if (typeof ASSETS_B64 !== 'undefined' && ASSETS_B64.LOGO_MARCA) {
      try { doc.addImage(ASSETS_B64.LOGO_MARCA, 'PNG', 10, 5.5, 21.6, 8.8); } catch (_) {  }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(titulo, 36, 11);

    const nomeAg = (typeof CONFIG_UNIDADE !== 'undefined' && CONFIG_UNIDADE.nome) || '';
    const agora = new Date();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    if (nomeAg) doc.text(nomeAg, largura - 10, 8, { align: 'right' });
    doc.text(`${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR').slice(0, 5)}`, largura - 10, 13, { align: 'right' });

    if (subtitulo) {
      doc.setFontSize(9);
      doc.text(subtitulo, 36, 19, { maxWidth: largura - 46 });
    }

    doc.setTextColor(...this._PDF_COR_TEXTO);
    return alturaFaixa + 9;
  },

  _pdfRodape(doc) {
    const nPag = doc.getNumberOfPages();
    const largura = doc.internal.pageSize.getWidth();
    const altura = doc.internal.pageSize.getHeight();
    for (let p = 1; p <= nPag; p++) {
      doc.setPage(p);
      doc.setDrawColor(226, 232, 240);
      doc.line(10, altura - 12, largura - 10, altura - 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(...this._PDF_COR_MUTED);
      doc.text('Gerado pelo NEXO — uso interno, dados protegidos pela LGPD (Lei nº 13.709/2018)', 10, altura - 7);
      doc.text(`Página ${p} de ${nPag}`, largura - 10, altura - 7, { align: 'right' });
    }
  },

  _pdfBlocoVinculo(doc, v, x, y, largura) {
    const alturaPagina = doc.internal.pageSize.getHeight();
    const margemBaixo = 20;
    const linhaAltura = 5.3;

    if (y + 7 + linhaAltura > alturaPagina - margemBaixo) { doc.addPage(); y = 16; }

    const tipoLimpo = v.tipo.replace(/[^\x00-\x7FÀ-ÿ]/g, '').trim();

    doc.setFillColor(...this._PDF_COR_PRIMARIA);
    doc.roundedRect(x, y, largura, 6.4, 1.2, 1.2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.3);
    doc.text(`${tipoLimpo}: ${v.chave}`, x + 3, y + 4.4);
    y += 6.4 + 3;

    doc.setFontSize(8);
    v.outros.forEach((r2) => {
      if (y > alturaPagina - margemBaixo) { doc.addPage(); y = 16; }
      const isForte = v.fortePares && v.fortePares.some((fp) => fp.cnpj === r2.cnpj);
      doc.setFillColor(...(isForte ? this._PDF_COR_FORTE : [148, 163, 184]));
      doc.circle(x + 2, y - 1.3, 0.9, 'F');
      doc.setFont('helvetica', isForte ? 'bold' : 'normal');
      doc.setTextColor(...(isForte ? this._PDF_COR_FORTE : this._PDF_COR_TEXTO));
      doc.text(
        `${r2.empresa.RAZAOSOCIAL || 'Empresa sem nome'} — ${_fmtCNPJ_ui(r2.cnpjOriginal)} — ${r2.unidade || '—'}`,
        x + 5.5, y,
      );
      y += linhaAltura;
    });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...this._PDF_COR_TEXTO);
    return y + 4;
  },

  _gerarPdfVinculos(cnpjOrig) {
    const calc = this._calcularVinculos(cnpjOrig);
    if (!calc || !calc.vinculos.length) {
      if (typeof _notificarUsuario === 'function') _notificarUsuario('Nenhum vínculo detectado para esta empresa.', 'warning');
      return;
    }
    if (!window.jspdf) {
      if (typeof _notificarUsuario === 'function') _notificarUsuario('jsPDF não está disponível.', 'error');
      return;
    }
    const { reg, vinculos } = calc;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const margem = 12;
    const larguraUtil = doc.internal.pageSize.getWidth() - margem * 2;

    let y = this._pdfCabecalho(
      doc, 'Relatório de Vínculos',
      `${reg.empresa.RAZAOSOCIAL || 'Empresa sem nome'}  ·  CNPJ ${_fmtCNPJ_ui(reg.cnpjOriginal)}`,
    );

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margem, y, larguraUtil, 13, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...this._PDF_COR_TEXTO);
    doc.text(String(reg.empresa.RAZAOSOCIAL || 'Empresa sem nome'), margem + 4, y + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(...this._PDF_COR_MUTED);
    doc.text(
      `Unidade: ${reg.unidade || '—'}   ·   Município: ${reg.municipio || '—'}   ·   Analista: ${reg.analista || '—'}`,
      margem + 4, y + 10,
    );
    y += 13 + 7;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...this._PDF_COR_TEXTO);
    doc.text(`${vinculos.length} vínculo(s) detectado(s)`, margem, y);
    y += 6;

    vinculos.forEach((v) => { y = this._pdfBlocoVinculo(doc, v, margem, y, larguraUtil); });

    this._pdfRodape(doc);
    const agora = new Date();
    const nomeArquivo = `vinculos_${(reg.cnpjOriginal || '').replace(/\D/g, '')}_${agora.toISOString().slice(0, 10)}.pdf`;
    doc.save(nomeArquivo);
  },

  _gerarPdfVinculosGrupo(items, labelGrupo) {
    if (!items || !items.length) return;
    if (!window.jspdf) {
      if (typeof _notificarUsuario === 'function') _notificarUsuario('jsPDF não está disponível.', 'error');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const margem = 12;
    const larguraUtil = doc.internal.pageSize.getWidth() - margem * 2;
    const alturaPagina = doc.internal.pageSize.getHeight();
    const margemBaixo = 20;

    let y = this._pdfCabecalho(doc, 'Relatório de Vínculos — Grupo', `${items.length} empresa(s)${labelGrupo ? `  ·  ${labelGrupo}` : ''}`);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...this._PDF_COR_TEXTO);
    doc.text('Empresas do grupo', margem, y);
    y += 5.5;

    const colunas = [
      { chave: 'razao',    titulo: 'Razão Social', w: larguraUtil * 0.32 },
      { chave: 'cnpj',     titulo: 'CNPJ',          w: larguraUtil * 0.19 },
      { chave: 'unidade',  titulo: 'Unidade',       w: larguraUtil * 0.19 },
      { chave: 'municipio', titulo: 'Município',    w: larguraUtil * 0.17 },
      { chave: 'status',   titulo: 'Status',        w: larguraUtil * 0.13 },
    ];
    const desenharCabecalhoTabela = () => {
      doc.setFillColor(...this._PDF_COR_PRIMARIA);
      doc.rect(margem, y, larguraUtil, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.3);
      let cx = margem + 2;
      colunas.forEach((c) => { doc.text(c.titulo, cx, y + 4); cx += c.w; });
      y += 6;
    };
    desenharCabecalhoTabela();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    items.forEach((reg, i) => {
      if (y > alturaPagina - margemBaixo) { doc.addPage(); y = 16; desenharCabecalhoTabela(); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6); }
      if (i % 2 === 1) { doc.setFillColor(...this._PDF_COR_FAIXA); doc.rect(margem, y, larguraUtil, 5.4, 'F'); }
      doc.setTextColor(...this._PDF_COR_TEXTO);
      let cx = margem + 2;
      const valores = {
        razao: reg.empresa.RAZAOSOCIAL || '—',
        cnpj: _fmtCNPJ_ui(reg.cnpjOriginal),
        unidade: reg.unidade || '—',
        municipio: reg.municipio || '—',
        status: reg.status || '—',
      };
      colunas.forEach((c) => {
        const texto = doc.splitTextToSize(String(valores[c.chave]), c.w - 2)[0] || '';
        doc.text(texto, cx, y + 3.6);
        cx += c.w;
      });
      y += 5.4;
    });
    y += 9;

    const porTel = new Map(), porEmail = new Map(), porContato = new Map();
    items.forEach((reg) => {
      reg.telefones.forEach((t) => { if (!porTel.has(t)) porTel.set(t, []); porTel.get(t).push(reg); });
      reg.emailsChave.forEach((e) => { if (!porEmail.has(e)) porEmail.set(e, []); porEmail.get(e).push(reg); });
      if (reg.nomeContato) { if (!porContato.has(reg.nomeContato)) porContato.set(reg.nomeContato, []); porContato.get(reg.nomeContato).push(reg); }
    });
    const fmtTel = (t) => t.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
    const secoes = [];
    for (const [tel, regs] of porTel) if (regs.length >= 2) secoes.push({ tipo: '📞 Telefone', chave: fmtTel(tel), outros: regs });
    for (const [em, regs] of porEmail) if (regs.length >= 2) secoes.push({ tipo: em.startsWith('@') ? '📧 Domínio e-mail' : '📧 E-mail', chave: em, outros: regs });
    for (const [nc, regs] of porContato) if (regs.length >= 2) secoes.push({ tipo: '👤 Nome de Contato', chave: nc, outros: regs });

    if (y > alturaPagina - margemBaixo - 12) { doc.addPage(); y = 16; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...this._PDF_COR_TEXTO);
    doc.text('Identificadores compartilhados neste grupo', margem, y);
    y += 6;

    if (!secoes.length) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...this._PDF_COR_MUTED);
      doc.text('Nenhum identificador (telefone/e-mail/contato) compartilhado entre 2 ou mais empresas deste grupo.', margem, y);
    } else {
      secoes.forEach((v) => { y = this._pdfBlocoVinculo(doc, v, margem, y, larguraUtil); });
    }

    this._pdfRodape(doc);
    const nomeArquivo = `vinculos_grupo_${new Date().toISOString().slice(0, 10)}_${items.length}emp.pdf`;
    doc.save(nomeArquivo);
  },

  _toggleVinculoDetalhe(cnpjOrig, trRef) {
    const ex=document.getElementById('_cruz2-detalhe');
    if (ex) { const era=ex.dataset.cnpj===cnpjOrig; ex.remove(); this._cnpjDetalheCRUZ=null; if(era)return; }
    this._cnpjDetalheCRUZ=cnpjOrig;
    const calc = this._calcularVinculos(cnpjOrig);
    if (!calc) return;
    const { reg, vinculos } = calc;
    if (!vinculos.length)return;

    const trD=document.createElement('tr'); trD.id='_cruz2-detalhe'; trD.dataset.cnpj=cnpjOrig; trD.className='cruz-vinculo-detalhe-row';
    const td=document.createElement('td'); td.colSpan=99;
    const wrap=document.createElement('div'); wrap.style.cssText='padding:14px 20px;background:rgba(79, 70, 229,0.06);border-left:4px solid var(--color-primary);border-top:1px solid rgba(79, 70, 229,0.2);';
    const tit=document.createElement('div'); tit.style.cssText='font-weight:700;font-size:0.88rem;color:var(--color-primary);margin-bottom:10px;'; tit.textContent=`Vínculos de: ${reg.empresa.RAZAOSOCIAL||cnpjOrig}`; wrap.appendChild(tit);

    vinculos.forEach(v=>{
      const bl=document.createElement('div'); bl.style.marginBottom='10px';
      const lbl=document.createElement('div'); lbl.style.cssText='font-size:0.82rem;font-weight:600;color:var(--text-muted);margin-bottom:5px;'; lbl.textContent=`${v.tipo}: ${v.chave}`; bl.appendChild(lbl);
      const chips=document.createElement('div'); chips.style.cssText='display:flex;flex-wrap:wrap;gap:6px;';
      v.outros.slice(0,12).forEach(r2=>{
        const isForte=v.fortePares&&v.fortePares.some(fp=>fp.cnpj===r2.cnpj);
        const chip=document.createElement('span');
        chip.style.cssText=`padding:3px 9px;background:var(--bg-body);border:1px solid ${isForte?'#ef4444':'var(--border-color)'};border-radius:4px;font-size:0.8rem;color:var(--text-main);${isForte?'font-weight:700;':''}`;

        chip.textContent=`${isForte?'⚡ ':''}${r2.empresa.RAZAOSOCIAL||'Empresa sem nome'} · ${_fmtCNPJ_ui(r2.cnpjOriginal)} · ${r2.unidade||'—'}`;
        chips.appendChild(chip);
      });
      if (v.outros.length>12){const m=document.createElement('span');m.style.cssText='padding:3px 8px;color:var(--text-muted);font-size:0.8rem;font-style:italic;';m.textContent=`+ ${v.outros.length-12} mais…`;chips.appendChild(m);}
      bl.appendChild(chips); wrap.appendChild(bl);
    });
    td.appendChild(wrap); trD.appendChild(td);
    trRef.insertAdjacentElement('afterend',trD);
  },

  _renderClustersCRUZ() {
    const corpo=document.getElementById('cruz-corpo'); if(!corpo)return;
    const linhas = this._linhasCRUZ();
    const cnpjsFiltrados = new Set(linhas.map(r=>r.cnpj));

    corpo.innerHTML=`<div id="cruz-clusters-wrap" style="padding:15px;display:flex;flex-direction:column;gap:16px;overflow-y:auto;max-height:calc(100vh - 320px);"></div>`;
    const wrap=document.getElementById('cruz-clusters-wrap');
    const CORES=['#dbeafe','#dcfce7','#fef9c3','#fce7f3','#ede9fe','#ffedd5','#cffafe','#fef2f2'];
    const cols=this._COLS_CRUZ.filter(d=>this._ativasCRUZ.has(d.key)&&d.key!=='vinculo');

    const cfg = this._agrupConfig;

    const computarMotivos = (items) => {
      const fmtTel = t => t.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
      const tags = [];
      if (cfg.telefone) {
        const m = new Map();
        for (const reg of items) for (const t of reg.telefones) m.set(t, (m.get(t)||0)+1);
        const shared = [...m.entries()].filter(([,n])=>n>=2);
        if (shared.length) tags.push(`📞 ${shared.slice(0,2).map(([t])=>fmtTel(t)).join(', ')}${shared.length>2?` +${shared.length-2}`:''}`);
      }
      if (cfg.email) {
        const m = new Map();
        for (const reg of items) for (const ch of reg.emailsChave) m.set(ch, (m.get(ch)||0)+1);
        const dominios = [...m.entries()].filter(([k,n])=>k.startsWith('@')&&n>=2);
        const exatos   = [...m.entries()].filter(([k,n])=>!k.startsWith('@')&&n>=2);
        if (dominios.length) tags.push(`🌐 ${dominios.slice(0,2).map(([k])=>k).join(', ')}${dominios.length>2?` +${dominios.length-2}`:''}`);
        if (exatos.length)   tags.push(`📧 ${exatos.slice(0,1).map(([k])=>k).join(', ')}${exatos.length>1?` +${exatos.length-1}`:''}`);
      }
      if (cfg.contato) {
        const m = new Map();
        for (const reg of items) if (reg.nomeContato) m.set(reg.nomeContato, (m.get(reg.nomeContato)||0)+1);
        const shared = [...m.entries()].filter(([,n])=>n>=2);
        if (shared.length) tags.push(`👤 ${shared.slice(0,2).map(([k])=>k).join(', ')}${shared.length>2?` +${shared.length-2}`:''}`);
      }
      return tags;
    };

    const buildBloco = (items, ci, explicitMotivos, label, isSingleton) => {
      const hex=CORES[ci%CORES.length];
      const bloco=document.createElement('div'); bloco.className='cruz-n3-bloco'; bloco.style.cssText=`border:2px solid ${isSingleton?'var(--border-color)':this._hexRgba(hex,0.8)};border-radius:8px;`;
      const hdr=document.createElement('div'); hdr.style.cssText=`background:${isSingleton?'var(--bg-body)':this._hexRgba(hex,0.4)};padding:10px 15px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-radius:6px 6px 0 0;`;
      const title=document.createElement('strong'); title.style.cssText='font-size:0.9rem;color:var(--text-main);margin-right:4px;'; title.textContent=label; hdr.appendChild(title);

      if (!isSingleton) {
        const motivoTags = explicitMotivos ?? computarMotivos(items);
        motivoTags.forEach(m=>{
          const badge=document.createElement('span');
          badge.style.cssText='font-size:0.75rem;background:rgba(0,0,0,0.12);padding:2px 8px;border-radius:10px;color:var(--text-main);white-space:nowrap;';
          badge.textContent=m; hdr.appendChild(badge);
        });

        const btnPdfGrupo=document.createElement('button');
        btnPdfGrupo.className='btn-cruz-action';
        btnPdfGrupo.style.marginLeft='auto';
        btnPdfGrupo.innerHTML='<i class="fas fa-file-pdf"></i> Exportar Grupo';
        btnPdfGrupo.title='Gerar PDF com a tabela das empresas deste grupo e os identificadores (telefone/e-mail/contato) que as ligam';
        btnPdfGrupo.onclick=e=>{ e.stopPropagation(); this._gerarPdfVinculosGrupo(items, label); };
        hdr.appendChild(btnPdfGrupo);
      }

      const sortCl={key:null,asc:true}, filtroCl={};
      const scrollD=document.createElement('div'); scrollD.style.cssText='overflow-x:auto;';
      const tbl=document.createElement('table'); tbl.className='preview-table v-lines cruz-grid'; tbl.style.cssText='width:100%;margin:0;';
      const thead=document.createElement('thead'); const tbody=document.createElement('tbody');
      const rebuildTh=()=>{
        const tr=document.createElement('tr');
        cols.forEach(def=>{
          tr.appendChild(this._buildFilterTh(def,sortCl,filtroCl,
            k=>{ this._cicloSort(sortCl,k); this._atualizarIconesSort(thead,sortCl); rebuildTb(); },
            ()=>rebuildTb(),
            cols, ()=>{ rebuildTh(); rebuildTb(); }
          ));
        });
        thead.innerHTML=''; thead.appendChild(tr);
      };
      const rebuildTb=()=>{
        tbody.innerHTML='';
        const visible=this._filtrarOrdenar(items,sortCl,filtroCl,this._ACC_CRUZ);
        this._lazyRender(tbody,visible,(reg)=>{
          const tr=document.createElement('tr'); tr.style.cssText='background:var(--bg-surface);';
          cols.forEach(def=>{
            const td=document.createElement('td'); td.style.cssText='font-size:0.85rem;color:var(--text-main);';
            switch(def.key){
              case 'cnpj':        td.style.fontFamily='monospace';td.style.fontSize='0.82rem';td.textContent=_fmtCNPJ_ui(reg.cnpjOriginal);break;
              case 'razaoSocial': td.textContent=reg.empresa.RAZAOSOCIAL||'-';break;
              case 'status':      td.textContent=reg.status||'-';break;
              case 'analista':     td.className='text-left';td.textContent=reg.analista||'-';break;
              case 'unidade':     td.textContent=reg.unidade||'-';break;
              case 'municipio':   td.textContent=reg.municipio||'-';break;
              case 'cnae':        td.textContent=reg.cnae||'-';break;
              case 'nomeContato': td.className='text-left';td.textContent=reg.nomeContato||'-';break;
            }
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        },50,scrollD,true);
      };
      rebuildTh(); rebuildTb();
      tbl.append(thead,tbody); scrollD.appendChild(tbl); bloco.append(hdr,scrollD); return bloco;
    };

    if (cfg.transitivo) {

      const clusters = CruzEngine.clustersConexos(cnpjsFiltrados, cfg);
      const emCluster = new Set(clusters.flatMap(cl=>cl.map(r=>r.cnpj)));
      const singletons = linhas.filter(r=>!emCluster.has(r.cnpj));

      const sub=document.getElementById('cruz-subtitulo');
      if(sub) sub.textContent=`${clusters.length} grupo(s) com vínculos · ${singletons.length} sem vínculo detectado · ${linhas.length} empresa(s) no total`;

      if (!clusters.length && !singletons.length) {
        wrap.innerHTML=`<p style="text-align:center;padding:30px;color:var(--text-muted);">Nenhum grupo encontrado para os filtros e métodos selecionados.</p>`; return;
      }

      this._lazyRender(wrap, clusters, (cluster, ci) => {
        const nomes=cluster.map(r=>r.empresa.RAZAOSOCIAL||'').filter(Boolean);

        const unidadesLbl=this._unidadesDoCluster(cluster);
        const label=`Grupo ${ci+1} — ${cluster.length} empresa(s) [${unidadesLbl}]: ${nomes.slice(0,2).join(' · ')}${nomes.length>2?` e +${nomes.length-2}`:''}`;
        wrap.appendChild(buildBloco(cluster, ci, null, label, false));
      }, 8, wrap, false);

      if (singletons.length) {
        const details=document.createElement('details'); details.style.cssText='margin-top:8px;';
        const summary=document.createElement('summary'); summary.style.cssText='cursor:pointer;padding:8px 12px;color:var(--text-muted);font-size:0.88rem;';
        summary.textContent=`${singletons.length} empresa(s) sem vínculo detectado (expandir)`;
        details.appendChild(summary);
        details.appendChild(buildBloco(singletons, clusters.length, null, 'Sem vínculo detectado', true));
        wrap.appendChild(details);
      }

    } else {

      const grupos = CruzEngine.clustersNaoTransitivos(cnpjsFiltrados, cfg);
      const sub=document.getElementById('cruz-subtitulo');
      if(sub) sub.textContent=`${grupos.length} grupo(s) por identificador direto · ${linhas.length} empresa(s) no escopo`;

      if (!grupos.length) {
        wrap.innerHTML=`<p style="text-align:center;padding:30px;color:var(--text-muted);">Nenhum vínculo direto encontrado para os métodos selecionados.</p>`; return;
      }

      this._lazyRender(wrap, grupos, (g, ci) => {
        const nomes=g.items.slice(0,2).map(r=>r.empresa.RAZAOSOCIAL||'').filter(Boolean);
        const unidadesLbl=this._unidadesDoCluster(g.items);
        const label=`${ci+1} — ${g.items.length} empresa(s) [${unidadesLbl}]: ${nomes.join(' · ')}${g.items.length>2?` e +${g.items.length-2}`:''}`;
        wrap.appendChild(buildBloco(g.items, ci, [g.motivo], label, false));
      }, 8, wrap, false);
    }
  },

  _abrirConfigAgrupar() {
    let modal = document.getElementById('_cruz-agrup-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = '_cruz-agrup-modal';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal-content" style="max-width:480px;">
          <div class="modal-header">
            <h3><i class="fas fa-cog" style="color:var(--color-primary)"></i> Configurar Agrupamento</h3>
            <button class="btn-icon" id="_agrup-close"><i class="fas fa-times"></i></button>
          </div>

          <p style="font-size:0.88rem;color:var(--text-muted);margin-bottom:16px;">
            Selecione quais tipos de vínculo formam grupos e se a transitividade deve ser aplicada.
          </p>

          <fieldset style="border:1px solid var(--border-color);border-radius:6px;padding:12px 16px;margin-bottom:16px;">
            <legend style="font-weight:600;font-size:0.88rem;padding:0 6px;">Métodos de Vínculo</legend>
            <div style="display:flex;flex-direction:column;gap:10px;margin-top:6px;">
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:0.9rem;">
                <input type="checkbox" id="_agrup-telefone"> Telefone
              </label>
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:0.9rem;">
                <input type="checkbox" id="_agrup-email"> E-mail
              </label>
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:0.9rem;">
                <input type="checkbox" id="_agrup-contato"> Contato (mesmo nome de responsável)
              </label>
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:0.9rem;">
                <input type="checkbox" id="_agrup-cep"> CEP / Endereço
                <span style="font-size:0.78rem;color:var(--text-muted);">⚠️ pode gerar grupos muito grandes</span>
              </label>
            </div>
          </fieldset>

          <fieldset style="border:1px solid var(--border-color);border-radius:6px;padding:12px 16px;margin-bottom:20px;">
            <legend style="font-weight:600;font-size:0.88rem;padding:0 6px;">Transitividade</legend>
            <div style="margin-top:8px;">
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:0.9rem;">
                <input type="checkbox" id="_agrup-transitivo">
                <span>Agrupamento transitivo</span>
                <span id="_agrup-info-btn" title="O que é transitividade?" style="cursor:help;font-size:1rem;">ℹ️</span>
              </label>
              <p id="_agrup-info-txt" style="display:none;font-size:0.8rem;color:var(--text-muted);margin:8px 0 0 28px;line-height:1.5;">
                <b>Com transitividade:</b> se A compartilha telefone com B, e B compartilha e-mail com C, então A + B + C formam <em>um único grupo</em> — mesmo que A e C não tenham nenhum dado em comum diretamente.<br><br>
                <b>Sem transitividade:</b> cada identificador compartilhado (cada telefone, cada e-mail) gera seu próprio grupo. Uma empresa pode aparecer em múltiplos grupos. Ideal para ver conexões diretas e específicas.
              </p>
            </div>
          </fieldset>

          <div style="display:flex;justify-content:flex-end;gap:10px;">
            <button id="_agrup-cancel" style="padding:8px 16px;background:transparent;border:1px solid var(--border-color);border-radius:4px;cursor:pointer;color:var(--text-main);">Cancelar</button>
            <button id="_agrup-apply" style="padding:8px 18px;background:var(--color-primary);color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;"><i class="fas fa-check"></i> Aplicar</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      document.getElementById('_agrup-close').onclick  = () => { modal.style.display = 'none'; };
      document.getElementById('_agrup-cancel').onclick = () => { modal.style.display = 'none'; };
      document.getElementById('_agrup-info-btn').onclick = () => {
        const p = document.getElementById('_agrup-info-txt');
        p.style.display = p.style.display === 'none' ? 'block' : 'none';
      };
    }

    document.getElementById('_agrup-telefone').checked   = this._agrupConfig.telefone;
    document.getElementById('_agrup-email').checked      = this._agrupConfig.email;
    document.getElementById('_agrup-contato').checked    = this._agrupConfig.contato;
    document.getElementById('_agrup-cep').checked        = this._agrupConfig.cepEndereco;
    document.getElementById('_agrup-transitivo').checked = this._agrupConfig.transitivo;

    const btnOld = document.getElementById('_agrup-apply');
    const btnNew = btnOld.cloneNode(true); btnOld.parentNode.replaceChild(btnNew, btnOld);
    btnNew.onclick = () => {
      this._agrupConfig.telefone    = document.getElementById('_agrup-telefone').checked;
      this._agrupConfig.email       = document.getElementById('_agrup-email').checked;
      this._agrupConfig.contato     = document.getElementById('_agrup-contato').checked;
      this._agrupConfig.cepEndereco = document.getElementById('_agrup-cep').checked;
      this._agrupConfig.transitivo  = document.getElementById('_agrup-transitivo').checked;
      modal.style.display = 'none';
      this._populateCRUZ();
    };

    modal.style.display = 'flex';
  },

  _cartasCRUZ() {
    if (typeof selectedCNPJs==='undefined'||selectedCNPJs.size===0){this._notif('Selecione ao menos uma empresa.','warning');return;}
    const empresas=[...selectedCNPJs].map(c=>{const n=CruzNorm.cnpj(c);return n?CruzEngine.indices.registros.get(n)?.empresa:null;}).filter(Boolean);
    if(!empresas.length)return;
    let modal=document.getElementById('_cruz-date-modal');
    if(!modal){
      modal=document.createElement('div');modal.id='_cruz-date-modal';modal.className='modal-overlay';modal.style.display='none';
      modal.innerHTML=`<div class="modal-content" style="max-width:420px;"><div class="modal-header"><h3><i class="fas fa-calendar" style="color:var(--color-danger)"></i> Data Limite</h3><button class="btn-icon" id="_cruz-date-close"><i class="fas fa-times"></i></button></div><p style="margin-bottom:12px;">Prazo para as <strong id="_cruz-date-qtd"></strong> empresas selecionadas.</p><input type="date" id="_cruz-date-input" style="width:100%;padding:8px;border:1px solid var(--border-color);border-radius:4px;background:var(--bg-surface);color:var(--text-main);"><div style="margin-top:15px;display:flex;justify-content:flex-end;gap:10px;"><button id="_cruz-date-cancel" style="padding:8px 16px;background:transparent;border:1px solid var(--border-color);border-radius:4px;cursor:pointer;color:var(--text-main);">Cancelar</button><button id="_cruz-date-confirm" style="padding:8px 16px;background:var(--color-danger);color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;"><i class="fas fa-print"></i> Gerar PDFs</button></div></div>`;
      document.body.appendChild(modal);
      document.getElementById('_cruz-date-close').onclick=()=>{modal.style.display='none';};
      document.getElementById('_cruz-date-cancel').onclick=()=>{modal.style.display='none';};
    }
    document.getElementById('_cruz-date-qtd').textContent=empresas.length;modal.style.display='flex';
    const bo=document.getElementById('_cruz-date-confirm'),bn=bo.cloneNode(true);bo.parentNode.replaceChild(bn,bo);
    bn.onclick=()=>{const data=document.getElementById('_cruz-date-input').value;if(!data){this._notif('Informe a data limite.','warning');return;}modal.style.display='none';typeof gerarPDFConsolidado==='function'&&gerarPDFConsolidado({tipoCarta:'auto',dataLimiteGlobal:data,incluirTermo:true,incluirRecibo:true,empresas});};
  },
};

(function() {
  if (document.getElementById('_cruz-scope-css')) return;
  const s=document.createElement('style'); s.id='_cruz-scope-css';
  s.textContent=`
    ._btn-escopo { background:rgba(255,255,255,0.12);color:white;border:1px solid rgba(255,255,255,0.3);padding:5px 10px;border-radius:4px;cursor:pointer;font-size:0.8rem;white-space:nowrap;transition:0.15s; }
    ._btn-escopo-ativo { background:rgba(255,255,255,0.35) !important;font-weight:700; }
  `;
  document.head.appendChild(s);
})();

(function(){
  const _m=switchMainToggle;
  switchMainToggle=function(s){_m(s);if(s==='contatos')ContatosUI.ativar();};
  const _s=switchSubToggle;
  switchSubToggle=function(el,id){_s(el,id);ContatosUI.aoMudarSubtoggle(id);};
})();
