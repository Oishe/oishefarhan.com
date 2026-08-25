" Have j and k navigate visual lines rather than logical ones
nmap j gj
nmap k gk

" I like using H and L for beginning/end of line
nmap H 0
nmap L $

" Quickly remove search highlights
" nmap <F9> :nohl

" Yank to system clipboard
set clipboard=unnamed

" Go back and forward with Ctrl+O and Ctrl+I
" (make sure to remove default Obsidian shortcuts for these to work)
exmap back obcommand app:go-back
nmap <C-o> :back
exmap forward obcommand app:go-forward
nmap <C-i> :forward

" Surround
exmap surround_wiki surround [[ ]]
exmap surround_double_quotes surround " "
exmap surround_single_quotes surround ' '
exmap surround_backticks surround ` `
exmap surround_brackets surround ( )
exmap surround_square_brackets surround [ ]
exmap surround_curly_brackets surround { }

" must use 'map' and not 'nmap'
map [[ :surround_wiki
nunmap s
vunmap s
map s" :surround_double_quotes
map s' :surround_single_quotes
map s` :surround_backticks
map sb :surround_brackets
map s( :surround_brackets
map s) :surround_brackets
map s[ :surround_square_brackets
map s] :surround_square_brackets
map s{ :surround_curly_brackets
map s} :surround_curly_brackets

" Maps pasteinto to Alt-p
map <A-p> :pasteinto

" Insert below/above oO
exmap blankBelow obcommand obsidian-editor-shortcuts:insertLineBelow
exmap blankAbove obcommand obsidian-editor-shortcuts:insertLineAbove
nmap o :blankBelow<CR>i
nmap O :blankAbove<CR>i
