// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
// License: GNU General Public License v3. See license.txt

window.doc={{ doc.as_json() }};

$(document).ready(function() {

        doc.supplier = "{{ doc.supplier }}";
        doc.currency = "{{ doc.currency }}";
        doc.currency_symbol = "{{ doc.currency_symbol }}";
        doc.number_format = "{{ doc.number_format }}";
        doc.buying_price_list = "{{ doc.buying_price_list }}";

        new rfq();
});
rfq = class rfq {
	constructor(){
        this.onfocus_select_all();
        this.change_qty();
        this.change_rate();
        this.terms();
        this.purchase_taxes();
        this.submit_rfq();
        this.navigate_quotations();
        this.quotation_timer();
	}
	onfocus_select_all(){
		$("input").click(function(){
			$(this).select();
		})
	}

	change_qty(){
		var me = this;
		$('.rfq-items').on("change", ".rfq-qty", function(){
			me.idx = parseFloat($(this).attr('data-idx'));
			me.qty = parseFloat(flt($(this).val())) || 0;
			me.rate = parseFloat(flt($(repl('.rfq-rate[data-idx=%(idx)s]',{'idx': me.idx})).val()));
			me.update_qty_rate();
			$(this).val(format_number(me.qty, doc.number_format, 2));
		})
	}

	change_rate(){
		var me = this;
		$(".rfq-items").on("change", ".rfq-rate", function(){
			me.idx = parseFloat($(this).attr('data-idx'));
			me.rate = parseFloat(flt($(this).val())) || 0;
			me.qty = parseFloat(flt($(repl('.rfq-qty[data-idx=%(idx)s]',{'idx': me.idx})).val()));
			me.update_qty_rate();
			$(this).val(format_number(me.rate, doc.number_format, 2));
		})
	}

	terms(){
		$(".terms").on("change", ".terms-feedback", function(){
			doc.terms = $(this).val();
		})
	
	}
        purchase_taxes(){

        var me = this;

        $(".purchase-taxes-template").on("change", function(){

                var template = $(this).val();

                doc.taxes_and_charges = template;
                doc.taxes = [];

                $(".purchase-taxes-body").html("");

                if(!template){

                        $(".purchase-taxes-table-wrapper").hide();

                        me.update_qty_rate();

                        return;
                }

                frappe.call({

                        method: "erpnext.controllers.accounts_controller.get_taxes_and_charges",

                        args: {
                                master_doctype: "Purchase Taxes and Charges Template",
                                master_name: template
                        },

                        callback: function(r){

                                if(r.exc){
                                        $(".purchase-taxes-table-wrapper").hide();
                                        return;
                                }

                                if(!r.message || !r.message.length){

                                        $(".purchase-taxes-table-wrapper").hide();

                                        return;
                                }

                                doc.taxes = r.message;

                                $(".purchase-taxes-table-wrapper").show();

                                me.calculate_taxes();

                        }

                });

        });

}        
        calculate_taxes(){

        var me = this;

        var net_total = 0;

        $.each(doc.items || [], function(idx, item){

                net_total += flt(item.amount);

        });


        var running_total = net_total;

        var html = "";


        $.each(doc.taxes || [], function(idx, tax){

                var tax_amount = 0;


                if(tax.charge_type === "Actual"){

                        tax_amount = flt(tax.tax_amount || 0);

                }

                else if(tax.charge_type === "On Net Total"){

                        tax_amount =
                                (flt(tax.rate) / 100) * net_total;

                }

                else if(tax.charge_type === "On Previous Row Amount"){

                        var previous_tax =
                                doc.taxes[flt(tax.row_id) - 1];

                        if(previous_tax){

                                tax_amount =
                                        (flt(tax.rate) / 100) *
                                        flt(previous_tax.tax_amount);

                        }

                }

                else if(tax.charge_type === "On Previous Row Total"){

                        var previous_tax =
                                doc.taxes[flt(tax.row_id) - 1];

                        if(previous_tax){

                                tax_amount =
                                        (flt(tax.rate) / 100) *
                                        flt(previous_tax.total);

                        }

                }


                tax.tax_amount = tax_amount;


                if(tax.add_deduct_tax === "Deduct"){

                        running_total -= tax_amount;

                } else {

                        running_total += tax_amount;

                }


                tax.total = running_total;


                html += `

                        <tr>

                                <td style="text-align:center;">
                                        ${idx + 1}
                                </td>

                                <td>
                                        ${frappe.utils.escape_html(
                                                tax.charge_type || ""
                                        )}
                                </td>

                                <td>
                                        ${frappe.utils.escape_html(
                                                tax.account_head || ""
                                        )}
                                </td>

                                <td style="text-align:right;">
                                        ${
                                                tax.charge_type === "Actual"
                                                ? "-"
                                                : format_number(
                                                        flt(tax.rate),
                                                        doc.number_format,
                                                        2
                                                  ) + "%"
                                        }
                                </td>

                                <td style="text-align:right;">
                                        ${format_number(
                                                net_total,
                                                doc.number_format,
                                                2
                                        )}
                                </td>

                                <td style="text-align:right;">
                                        ${doc.currency_symbol}
                                        ${format_number(
                                                tax_amount,
                                                doc.number_format,
                                                2
                                        )}
                                </td>

                                <td style="text-align:right;">
                                        ${doc.currency_symbol}
                                        ${format_number(
                                                running_total,
                                                doc.number_format,
                                                2
                                        )}
                                </td>

                        </tr>

                `;

        });


        $(".purchase-taxes-body").html(html);


        doc.grand_total = running_total;


        $(".tax-grand-total").text(
                format_number(
                        doc.grand_total,
                        doc.number_format,
                        2
                )
        );

        }

        quotation_timer(){
	var opening = doc.custom_quotation_opening_date__time;
	var closing = doc.custom_quotation_closing_date__time;

    if(!opening && !closing){
        $("#rfq-time-box").hide();
        return;
    }

    function update_timer(){

        var now = new Date();

        if(opening){
            var start = new Date(opening.replace(" ", "T"));

            if(now < start){
                var diff = start - now;

                var days = Math.floor(diff / 86400000);
                var hours = Math.floor((diff / 3600000) % 24);
                var minutes = Math.floor((diff / 60000) % 60);
                var seconds = Math.floor((diff / 1000) % 60);

                $("#rfq-countdown").text(
                    "Opens in: " +
                    days + "d " +
                    hours + "h " +
                    minutes + "m " +
                    seconds + "s"
                );

                $("#rfq-deadline").text(
                    "Quotation submission has not opened yet."
                );

                $("#make-quotation").prop("disabled", true);

                return;
            }
        }

        if(closing){
            var end = new Date(closing.replace(" ", "T"));
            var diff = end - now;

            if(diff <= 0){

                $("#rfq-countdown").text(
                    "Quotation submission closed"
                );

                $("#rfq-deadline").text(
                    "The submission deadline has expired."
                );

                $("#make-quotation").prop("disabled", true);

                return;
            }

            var days = Math.floor(diff / 86400000);
            var hours = Math.floor((diff / 3600000) % 24);
            var minutes = Math.floor((diff / 60000) % 60);
            var seconds = Math.floor((diff / 1000) % 60);

            $("#rfq-countdown").text(
                days + "d " +
                hours + "h " +
                minutes + "m " +
                seconds + "s remaining"
            );

            $("#rfq-deadline").text(
                "Deadline: " + end.toLocaleString()
            );

            $("#make-quotation").prop("disabled", false);
        }
    }

    update_timer();
    setInterval(update_timer, 1000);
}           
	update_qty_rate(){
        var me = this;
        doc.grand_total = 0.0;

        $.each(doc.items, function(idx, data){

                if(data.idx == me.idx){
                        data.qty = me.qty;
                        data.rate = me.rate;
                        data.amount = (me.rate * me.qty) || 0.0;

                        $(repl(
                                '.rfq-amount[data-idx=%(idx)s]',
                                {'idx': me.idx}
                        )).text(
                                format_number(
                                        data.amount,
                                        doc.number_format,
                                        2
                                )
                        );
                }

                doc.grand_total += flt(data.amount);

        });


        if(doc.taxes && doc.taxes.length){

                me.calculate_taxes();

        } else {

                $('.tax-grand-total').text(
                        format_number(
                                doc.grand_total,
                                doc.number_format,
                                2
                        )
                );

        }

}	submit_rfq(){
                var me = this;

                $('.btn-sm').click(function(){

                        frappe.freeze();

                        var quotation_number =
                                $(".quotation-number").val().trim();

                        doc.quotation_number = quotation_number;

                        var tax_template =
                                $(".purchase-taxes-template").val();

                        doc.taxes_and_charges = tax_template || null;

                        if (doc.taxes && doc.taxes.length) {
                                me.calculate_taxes();
                        }

                        frappe.call({
                                type: "POST",
                                method:
                                "erpnext.buying.doctype.request_for_quotation.request_for_quotation.create_supplier_quotation",

                                args: {
                                        doc: doc
                                },

                                btn: this,

                                callback: function(r){

                                        frappe.unfreeze();

                                        if(r.message){

                                                $('.btn-sm').hide();

                                                window.location.href =
                                                        "/supplier-quotations/" +
                                                        encodeURIComponent(r.message);

                                        }
                                }
                        });
                });
        }
        navigate_quotations() {
		$('.quotations').click(function(){
			name = $(this).attr('idx')
			window.location.href = "/quotations/" + encodeURIComponent(name);
		})
	}
}
