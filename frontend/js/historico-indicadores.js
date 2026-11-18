// EduAlerta — Histórico e Indicadores (HTML, CSS e JavaScript puro).
// Dados exibidos inicialmente são EXEMPLOS EXTRAÍDOS DO FIGMA, não dados reais.
// Para integrar à API: window.EduAlertaRelatorios.setDados({ resumo, escolas, turmas, distribuicao, evolucao })
// Para abrir sem os exemplos: historico-indicadores.html?modo=real
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const node = (tag, className = '', value) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined) el.textContent = String(value);
    return el;
  };
  const example = {
    resumo: { frequencia: 91.8, risco: 558, escolas: 42,
      notaFrequencia: 'Exemplo comparativo de frequência',
      notaRisco: 'Exemplo comparativo de alunos em risco',
      notaEscolas: 'Exemplo ilustrativo da rede municipal' },
    escolas: [
      { nome: 'EM Prof. Antônio Farias', frequencia: 96.2 },
      { nome: 'EM Poeta João Cabral', frequencia: 92.7 },
      { nome: 'EM Bomba do Hemetério', frequencia: 89.3 },
      { nome: 'EM Professor Cícero Dias', frequencia: 87.1 },
      { nome: 'EM Dom Helder Câmara', frequencia: 84.6 }
    ],
    distribuicao: { alto: 237, atencao: 558, regular: 2052 },
    turmas: [
      { turma: '6º Ano A', escola: 'EM Dom Helder Câmara', frequencia: 95.2, atencao: 3, total: 28 },
      { turma: '6º Ano B', escola: 'EM Prof. Antônio Farias', frequencia: 92.1, atencao: 5, total: 30 },
      { turma: '7º Ano A', escola: 'EM Poeta João Cabral', frequencia: 88.4, atencao: 7, total: 29 },
      { turma: '8º Ano A', escola: 'EM Prof. Antônio Farias', frequencia: 85.7, atencao: 9, total: 32 },
      { turma: '9º Ano A', escola: 'EM Dom Helder Câmara', frequencia: 82.6, atencao: 11, total: 27 }
    ],
    // A curva abaixo é uma referência visual aproximada: NÃO é série histórica real.
    evolucao: []
  };
  let demo = new URLSearchParams(location.search).get('modo') !== 'real' && !window.EDUALERTA_REPORTS_DATA;
  let data = demo ? example : {resumo:{},escolas:[],turmas:[],estudantes:[],distribuicao:{},evolucao:[]};
  let toastTimer;
  function toast(message) {
    const t = $('#toast'); t.textContent = message; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4500);
  }
  const sidebar = $('#sidebar');
  const toggle = $('#toggle-sidebar');
  const pairs = [['notifications-button','notifications-panel'], ['account-button','account-panel']];
  function closeMenus() {
    for (const [button,panel] of pairs) {
      $(`#${panel}`).hidden = true;
      $(`#${button}`).setAttribute('aria-expanded','false');
    }
  }
  for (const [button,panel] of pairs) {
    $(`#${button}`).addEventListener('click', e => {
      e.stopPropagation();
      const p = $(`#${panel}`), opening = p.hidden;
      closeMenus(); p.hidden = !opening;
      $(`#${button}`).setAttribute('aria-expanded',String(opening));
    });
  }
  toggle.addEventListener('click', () => {
    const open = sidebar.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded',String(open));
    toggle.setAttribute('aria-label',open?'Fechar navegação':'Abrir navegação');
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.dropdown-wrap')) closeMenus();
    if (innerWidth <= 740 && sidebar.classList.contains('is-open') && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
      sidebar.classList.remove('is-open'); toggle.setAttribute('aria-expanded','false');
    }
  });
  document.addEventListener('keydown',e => {
    if (e.key === 'Escape') {closeMenus(); sidebar.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');}
  });
  document.querySelectorAll('[data-future]').forEach(b => b.addEventListener('click', () => toast(`A seção “${b.dataset.future}” ainda será implementada.`)));

  const number = (v) => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(typeof v === 'string' ? v.replace('%','').replace(',','.') : v);
    return Number.isFinite(n) ? n : null;
  };
  const fmt = (v) => number(v) === null ? '—' : number(v).toLocaleString('pt-BR',{maximumFractionDigits:1});
  const percent = v => number(v) === null ? '—' : `${number(v).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
  const safePercent = (v) => Math.max(0,Math.min(100,number(v) ?? 0));
  const unique = values => [...new Set(values.filter(Boolean).map(String))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const schoolSelect = $('#filter-school'), classSelect = $('#filter-class'), studentSelect = $('#filter-student');
  const periodSelect = $('#filter-period'), attendanceStatusSelect = $('#filter-attendance-status');
  function updateSelect(select, values, allLabel) {
    const previous = select.value; select.replaceChildren();
    const first = node('option','',allLabel); first.value='';select.append(first);
    for (const value of unique(values)) {const option=node('option','',value);option.value=value;select.append(option);}
    select.value=values.includes(previous)?previous:'';
  }
  function updateFilters() {
    const schools = [...(data.escolas||[]).map(r=>r.nome),...(data.turmas||[]).map(r=>r.escola)];
    updateSelect(schoolSelect,schools,'Todas as escolas');
    const turmas = (data.turmas||[]).filter(r=>!schoolSelect.value||r.escola===schoolSelect.value);
    updateSelect(classSelect,turmas.map(r=>r.turma),'Todas as turmas');
    const students = Array.isArray(data.estudantes) ? data.estudantes : [];
    const matchingStudents = students.filter((student)=>
      (!schoolSelect.value||student.escola===schoolSelect.value) &&
      (!classSelect.value||(student.turma??student.className)===classSelect.value));
    const previousStudent = studentSelect.value;
    studentSelect.replaceChildren();
    const studentPlaceholder=node('option','',students.length?'Todos os estudantes':'Estudantes aguardando integração');
    studentPlaceholder.value='';
    studentSelect.append(studentPlaceholder);
    for (const student of matchingStudents) {
      const id=String(student.id??student.studentId??student.alunoId??student.matricula??student.registro??'');
      if (!id) continue;
      const name=String(student.nome??student.aluno??student.name??'Estudante');
      const registration=String(student.matricula??student.registro??'');
      const option=node('option','',[name,registration].filter(Boolean).join(' · '));
      option.value=id;
      studentSelect.append(option);
    }
    studentSelect.disabled=studentSelect.options.length<=1;
    studentSelect.value=Array.from(studentSelect.options).some(option=>option.value===previousStudent)?previousStudent:'';
    if (!demo) updateSelect(periodSelect,Array.isArray(data.periodos)?data.periodos:[],'Todos');
  }
  function isPeriodVisible() {
    // O Figma representa outubro de 2026. Setembro não tem dados específicos na prévia.
    return !demo || periodSelect.value === '' || periodSelect.value === 'outubro/2026';
  }
  function attendanceStatus(student) {
    const raw=String(student.situacaoFrequencia??student.statusFrequencia??student.situacao??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if (['regular','em dia'].includes(raw)) return 'regular';
    if (['atencao','em atencao'].includes(raw)) return 'atencao';
    if (['alerta','alto risco','critico','critica'].includes(raw)) return 'alerta';
    const frequency=number(student.frequencia??student.frequenciaPercentual??student.attendance);
    return frequency===null?'':frequency>=75?'regular':frequency>=60?'atencao':'alerta';
  }
  function filteredStudents() {
    if (!isPeriodVisible()) return [];
    return (data.estudantes||[]).filter(student=>
      (!schoolSelect.value||student.escola===schoolSelect.value) &&
      (!classSelect.value||(student.turma??student.className)===classSelect.value) &&
      (!studentSelect.value||String(student.id??student.studentId??student.alunoId??student.matricula??student.registro??'')===studentSelect.value) &&
      (!attendanceStatusSelect.value||attendanceStatus(student)===attendanceStatusSelect.value) &&
      (!periodSelect.value||!student.periodo||String(student.periodo)===periodSelect.value));
  }
  function aggregateStudents(students) {
    const groups=new Map();
    for (const student of students) {
      const turma=String(student.turma??student.className??'Turma não informada');
      const escola=String(student.escola??'Escola não informada');
      const key=`${escola}\u0000${turma}`;
      if (!groups.has(key)) groups.set(key,{turma,escola,frequencias:[],atencao:0,total:0});
      const group=groups.get(key);
      const frequency=number(student.frequencia??student.frequenciaPercentual??student.attendance);
      if (frequency!==null) group.frequencias.push(frequency);
      if (attendanceStatus(student)==='atencao') group.atencao++;
      group.total++;
    }
    return Array.from(groups.values()).map(group=>({
      turma:group.turma,escola:group.escola,
      frequencia:group.frequencias.length?group.frequencias.reduce((sum,value)=>sum+value,0)/group.frequencias.length:null,
      atencao:group.atencao,total:group.total
    }));
  }
  function usesIndividualFilters() {
    return Boolean(studentSelect.value||attendanceStatusSelect.value);
  }
  function filteredRows() {
    if (!isPeriodVisible()) return [];
    if (usesIndividualFilters()) return aggregateStudents(filteredStudents());
    return (data.turmas||[]).filter(r=>(!schoolSelect.value||r.escola===schoolSelect.value) && (!classSelect.value||r.turma===classSelect.value));
  }
  function filteredSchools(rows) {
    if (!isPeriodVisible()) return [];
    if (usesIndividualFilters()) {
      const names=new Set(rows.map(r=>r.escola));
      return (data.escolas||[]).filter(s=>names.has(s.nome));
    }
    let records = data.escolas||[];
    if (schoolSelect.value) records=records.filter(s=>s.nome===schoolSelect.value);
    if (classSelect.value) {
      const names=new Set(rows.map(r=>r.escola));
      records=records.filter(s=>names.has(s.nome));
    }
    return records;
  }
  function canShowGlobalSummary() {return isPeriodVisible() && !schoolSelect.value && !classSelect.value && !studentSelect.value && !attendanceStatusSelect.value;}
  function updateKpis() {
    const summary = canShowGlobalSummary()? data.resumo||{} : {};
    $('#kpi-attendance').textContent=percent(summary.frequencia);
    $('#kpi-risk').textContent=fmt(summary.risco);
    $('#kpi-schools').textContent=fmt(summary.escolas);
    const note = canShowGlobalSummary() ? (demo ? 'Valor ilustrativo para demonstração' : 'Informação não disponível') : 'Resumo não disponível para esta seleção';
    $('#kpi-attendance-note').textContent=summary.notaFrequencia || note;
    $('#kpi-risk-note').textContent=summary.notaRisco || note;
    $('#kpi-schools-note').textContent=summary.notaEscolas || note;
    const hasData=Object.values(data.resumo||{}).some(value=>number(value)!==null)||(data.escolas||[]).length+(data.turmas||[]).length+(data.estudantes||[]).length>0;
    $('#reports-data-state').textContent=demo?'Demonstração · dados ilustrativos':hasData?'Informações atualizadas':'Nenhuma informação disponível';
    $('#reports-data-state').removeAttribute('data-error');
    $('#reports-footer').textContent=demo?'EduAlerta · Prévia de relatórios. Os valores de demonstração não representam dados reais.':'EduAlerta · Relatórios.';
  }
  function renderSchools(schools) {
    const bars=$('#school-bars'), labels=$('#school-labels'), empty=$('#schools-empty');
    bars.replaceChildren();labels.replaceChildren();
    const count=schools.length || 1;
    bars.style.setProperty('--bar-count',count);labels.style.setProperty('--bar-count',count);
    empty.hidden=schools.length>0;
    $('.reports-bars-layout').hidden=schools.length===0;
    if (!schools.length) {empty.textContent='Frequência por escola indisponível para os filtros selecionados.';return;}
    for (const school of schools) {
      const slot=node('div','reports-bar-column');
      slot.append(node('span','reports-bar-number',percent(school.frequencia)));
      const bar=node('div','reports-bar');bar.style.height=`${safePercent(school.frequencia)}%`;
      bar.title=`${school.nome}: ${percent(school.frequencia)}`;
      bar.setAttribute('role','img');bar.setAttribute('aria-label',bar.title);
      bar.tabIndex=0;slot.append(bar);bars.append(slot);
      labels.append(node('span','',school.nome));
    }
  }
  function renderRisk() {
    const dist = canShowGlobalSummary() ? data.distribuicao || {} : {};
    const parts=['alto','atencao','regular'].map(k=>Math.max(0,number(dist[k]) ?? 0));
    const total=parts.reduce((a,b)=>a+b,0);const empty=$('#risk-empty');
    empty.hidden=total>0;
    $('.reports-risk-content').hidden=total===0;
    if (!total) {empty.textContent='Distribuição indisponível para o filtro selecionado.';return;}
    const [alto,atencao,regular]=parts;
    const legend=$('#risk-legend');legend.replaceChildren();
    for (const [k,n,cls] of [['Alto risco',alto,'red'],['Atenção',atencao,'yellow'],['Regular',regular,'green']]) {
      const item=node('div');item.append(node('i',cls),node('span','',k),node('span','',`(${fmt(n)})`));legend.append(item);
    }
    const red=alto/total*100, yellow=atencao/total*100, green=regular/total*100;
    const donut=$('#risk-donut');
    donut.style.background=`conic-gradient(from 90deg,#26a885 0 ${green}%,#ffca51 ${green}% ${green+yellow}%,#d53332 ${green+yellow}% 100%)`;
    donut.setAttribute('aria-label',`Alto risco: ${fmt(alto)}; atenção: ${fmt(atencao)}; regular: ${fmt(regular)}`);
    const donutDiameter=donut.getBoundingClientRect().width;
    const centerDiameter=$('.reports-donut-center').getBoundingClientRect().width;
    const labelRadius=donutDiameter?(25*(1+centerDiameter/donutDiameter)):40.5;
    const positionLabel=(id,start,portion)=>{
      const label=$(id);
      label.hidden=portion===0;
      if (!portion) return;
      const angle=(90+(start+portion/2)*3.6)*Math.PI/180;
      label.style.left=`${50+Math.sin(angle)*labelRadius}%`;
      label.style.top=`${50-Math.cos(angle)*labelRadius}%`;
    };
    positionLabel('#donut-risk-label',green+yellow,red);
    positionLabel('#donut-attention-label',green,yellow);
    positionLabel('#donut-regular-label',0,green);
    $('#donut-risk-label').textContent=`${red.toFixed(1).replace('.',',')}%`;
    $('#donut-attention-label').textContent=`${yellow.toFixed(1).replace('.',',')}%`;
    $('#donut-regular-label').textContent=`${green.toFixed(1).replace('.',',')}%`;
  }
  const SVG_NS='http://www.w3.org/2000/svg';
  const svgNode=(tag,attrs={})=>{const el=document.createElementNS(SVG_NS,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));return el;};
  function renderTrend() {
    const chart=$('#trend-chart');chart.replaceChildren();
    const empty=$('#trend-empty');
    const series=$('#trend-series').value;
    const history=canShowGlobalSummary() ? (data.evolucao||[]) : [];
    const raw=history.map(r=>({periodo:String(r.periodo||r.mes||''),value:number(r[series])})).filter(r=>r.value!==null);
    empty.hidden=raw.length===0; chart.hidden=raw.length===0;
    if (!raw.length) {
      empty.textContent=demo?'A evolução será exibida quando houver dados históricos disponíveis.':'Não há dados de evolução para o filtro selecionado.';
      return;
    }
    const width=450,height=116,l=29,r=12,t=12,b=24;const max=series==='frequencia'?100:Math.max(1,...raw.map(d=>d.value));
    const x=i=>l+(width-l-r)*(raw.length===1?.5:i/(raw.length-1));
    const y=v=>t+(height-t-b)*(1-Math.max(0,Math.min(max,v))/max);
    const svg=svgNode('svg',{viewBox:`0 0 ${width} ${height}`,'aria-label':`Evolução ${series==='frequencia'?'da frequência média':'de alunos em risco'}: ${raw.map(d=>`${d.periodo}: ${fmt(d.value)}`).join('; ')}`,role:'img'});
    for(let v=0;v<=4;v++){const yy=t+(height-t-b)*v/4;svg.append(svgNode('line',{x1:l,y1:yy,x2:width-r,y2:yy,stroke:'#e5ecf5','stroke-width':1}));}
    const line=svgNode('polyline',{fill:'none',stroke:'#2e83ed','stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round',points:raw.map((d,i)=>`${x(i)},${y(d.value)}`).join(' ')});svg.append(line);
    raw.forEach((d,i)=>{
      svg.append(svgNode('circle',{cx:x(i),cy:y(d.value),r:3,fill:'#1474e9'}));
      const txt=svgNode('text',{x:x(i),y:height-5,'text-anchor':'middle','font-size':10,fill:'#677b91'});txt.textContent=d.periodo;svg.append(txt);
    });chart.append(svg);
  }
  function renderTable(rows) {
    const tbody=$('#reports-tbody');tbody.replaceChildren();
    for (const r of rows) {
      const tr=node('tr');
      [r.turma,r.escola,percent(r.frequencia),fmt(r.atencao),fmt(r.total)].forEach(value=>tr.append(node('td','',value)));
      tbody.append(tr);
    }
    if (!rows.length) {const tr=node('tr'),td=node('td','reports-empty-row','Nenhum registro para os filtros selecionados.');td.colSpan=5;tr.append(td);tbody.append(tr);}
    $('#reports-count').textContent=demo?`${rows.length} turma(s) de demonstração · valores ilustrativos`:`${rows.length} turma(s) na consulta`;
  }
  function filterSummary() {
    const values=[
      ['Escola',schoolSelect],
      ['Turma',classSelect],
      ['Estudante',studentSelect],
      ['Período',periodSelect],
      ['Situação de frequência',attendanceStatusSelect]
    ].filter(([,select])=>select.value).map(([label,select])=>`${label}: ${select.selectedOptions[0].textContent}`);
    return values.length?`Filtros aplicados — ${values.join(' · ')}`:'Filtros aplicados — sem restrições.';
  }
  function render() {
    const rows=filteredRows(); updateKpis(); renderSchools(filteredSchools(rows));renderRisk();renderTrend();renderTable(rows);
    $('#reports-filter-summary').textContent=filterSummary();
  }
  schoolSelect.addEventListener('change',()=>{updateFilters();render();});
  classSelect.addEventListener('change',()=>{updateFilters();render();});
  studentSelect.addEventListener('change',render);
  periodSelect.addEventListener('change',render);
  attendanceStatusSelect.addEventListener('change',render);
  $('#trend-series').addEventListener('change',renderTrend);
  $('#generate-report').addEventListener('click',()=>{
    const rows=filteredRows();
    if (!rows.length && !filteredSchools(rows).length) {toast('Não há informações para gerar um relatório com esta seleção.');return;}
    $('#reports-filter-summary').textContent=filterSummary();
    toast(demo?'Abrindo a impressão do relatório demonstrativo. Escolha “Salvar como PDF” na janela de impressão.':'Abrindo a impressão do relatório. Escolha “Salvar como PDF” na janela de impressão.');
    window.print();
  });
  function csvEscape(v){
    const source=String(v??'');
    const safe=/^[\s]*[=+\-@]/.test(source)?`'${source}`:source;
    return `"${safe.replaceAll('"','""')}"`;
  }
  $('#download-report').addEventListener('click',()=>{
    const detailRows=usesIndividualFilters()?filteredStudents():[];
    const rows=filteredRows();
    if (usesIndividualFilters()&&!detailRows.length || !usesIndividualFilters()&&!rows.length) {toast('Não há registros para exportar com esta seleção.');return;}
    const detail=usesIndividualFilters();
    const head=detail?['Estudante','Matrícula','Escola','Turma','Frequência (%)','Situação']:['Turma','Escola','Frequência (%)','Alunos em atenção','Total de alunos'];
    const records=detail?detailRows.map(student=>[
      student.nome??student.aluno??student.name??'',
      student.matricula??student.registro??'',
      student.escola??'',
      student.turma??student.className??'',
      fmt(student.frequencia??student.frequenciaPercentual??student.attendance),
      attendanceStatus(student)
    ]):rows.map(row=>[row.turma,row.escola,fmt(row.frequencia),fmt(row.atencao),fmt(row.total)]);
    try {
      const csv='\ufeff'+[head,...records].map(row=>row.map(csvEscape).join(';')).join('\r\n');
      const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=node('a');
      a.href=url;a.download=demo?'edu-alerta-demonstracao.csv':'edu-alerta-relatorio.csv';
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      toast(demo?'CSV demonstrativo exportado com os filtros atuais; não contém dados reais.':'CSV exportado com os filtros atuais.');
    } catch (error) {
      toast(`Não foi possível gerar o CSV: ${error.message}`);
    }
  });
  function setDados(value) {
    if (!value || typeof value!=='object' || Array.isArray(value)) throw new TypeError('setDados espera um objeto de relatório.');
    for (const key of ['escolas','turmas','estudantes','evolucao','periodos']) {
      if (value[key] !== undefined && !Array.isArray(value[key])) throw new TypeError(`${key} precisa ser uma lista.`);
    }
    demo=false;
    data={resumo:value.resumo||{},escolas:value.escolas||[],turmas:value.turmas||[],estudantes:value.estudantes||[],distribuicao:value.distribuicao||{},evolucao:value.evolucao||[],periodos:value.periodos||[]};
    updateFilters();render();
  }
  window.EduAlertaRelatorios=Object.freeze({
    setDados,
    setCarregando(){
      demo=false;data={resumo:{},escolas:[],turmas:[],estudantes:[],distribuicao:{},evolucao:[],periodos:[]};
      updateFilters();render();
      $('#reports-data-state').textContent='Carregando relatórios…';
      $('#reports-data-state').removeAttribute('data-error');
    },
    setErro(message){
      demo=false;data={resumo:{},escolas:[],turmas:[],estudantes:[],distribuicao:{},evolucao:[],periodos:[]};
      updateFilters();render();
      $('#reports-data-state').textContent=String(message||'Não foi possível carregar os relatórios.');
      $('#reports-data-state').dataset.error='true';
    }
  });
  if(window.EDUALERTA_REPORTS_DATA) setDados(window.EDUALERTA_REPORTS_DATA);else {updateFilters();render();}
})();
